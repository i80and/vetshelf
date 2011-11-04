#!/usr/bin/env python

import socket
import asyncore
import sexp
import database

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'

VERSION = 1

PERM_NONE = 0
PERM_READ = 1
PERM_WRITE = 2


class Permissions(object):
	"""Class representing a connection's permissions."""
	def __init__(self, records=PERM_NONE):
		self._records = records

	@property
	def can_read_records(self):
		return self._records >= PERM_READ

	@property
	def can_write_records(self):
		return self._records == PERM_WRITE

	def modify(self, records=None):
		"""Modify this connections's permissions."""
		if records != None:
			self._records = records


def error(code):
	"""Return an error structure."""
	return ['error', str(code)]


def make_handler(dispatchf):
	"""Create a request handler class based on the given dispatch function."""
	class Handler(asyncore.dispatcher):
		def __init__(self, sock, client_addr, server):
			self.server = server
			self.client = client_addr
			self.inbuffer = []
			self.outbuffer = ''
			self.is_writable = False
			asyncore.dispatcher.__init__(self, sock)

			self.ctx = {'auth': Permissions()}

		def writable(self):
			return self.is_writable

		def handle_read(self):
			data = self.recv(1024)
			if data:
				self.inbuffer.append(str(data, 'utf-8'))
			else:
				request = ''.join(self.inbuffer)
				self.inbuffer = []
				self.outbuffer = sexp.dump(self.handle(request))
				self.is_writable = True

		def handle_write(self):
			if self.buffer:
				self.send(bytes(self.outbuffer, 'utf-8'))
				self.is_writable = False
				self.outbuffer = ''

		def handle(self, request):
			try:
				request = sexp.parse(request)
			except sexp.ParseError:
				return error('malformed')

			return dispatchf(self.ctx, request)

	return Handler


class NetServer(asyncore.dispatcher):
	"""Internal TCP server class."""
	def __init__(self, host, port, handler):
		asyncore.dispatcher.__init__(self)
		self.handler = handler

		self.create_socket(socket.AF_INET, socket.SOCK_STREAM)

		self.bind((host, port))
		self.listen(5)

	def serve_forever(self):
		asyncore.loop()

	def handle_accept(self):
		(sock, client_addr) = self.accept()
		return self.handler(sock, client_addr, self)


def make_server(config):
	"""Create and return a server with the given configuration data."""
	vetdb = database.Database(config['database'][0])

	def handle_auth(ctx, request):
		"""Handle an authentication request."""
		ctx['auth'].modify(records=PERM_WRITE)

	def handle_get(ctx, request):
		"""Handle a record retrieval request."""
		return error('unimplemented')

		rectype = request[0]
		recid = request[1]

		if rectype == 'client':
			data = vetdb.get_client(recid)
		elif rectype == 'patient':
			data = vetdb.get_patient(recid)
		else:
			return error('badrequest')

		return data

	def handle_set(ctx, request):
		"""Handle setting a record."""
		return error('unimplemented')
		rectype = request[0]
		recid = request[1]

	def dispatch(ctx, request):
		"""Dispatch a request to the appropriate handler."""
		auth = ctx['auth']
		command = request[0]
		body = []
		if len(request) > 1:
			body = request[1:]

		handlers = {'version?': (lambda auth: True, lambda ctx, req: VERSION),
					'auth': (lambda auth: True, handle_auth),
					'get': (lambda auth: auth.can_read_record(), handle_get),
					'set': (lambda auth: auth.can_write_record(), handle_set),
					'search': (lambda auth: auth.can_read_record(), None)}

		handler = handlers[command]
		if handler[0](auth):
			return handler[1](ctx, body)

		return error('badauth')

	port = int(config['server'][1])
	handler = make_handler(dispatch)
	server = NetServer('localhost', port, handler)

	return server


def main():
	config = sexp.maplist([['database', 'foo.db'], ['server', 'test-server', 6060]])
	server = make_server(config)
	server.serve_forever()

if __name__ == '__main__':
	main()
