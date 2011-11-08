#!/usr/bin/env python
import copy
import socket
import asyncore
import database
import vetmarshal
import sexp

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'

VERSION = 1


class Permissions(object):
	READ = 1
	WRITE = 2

	"""Class representing a connection's permissions."""
	def __init__(self, records=0):
		self.records = records

	@property
	def can_read_records(self):
		return bool(self.records)

	@property
	def can_write_records(self):
		return self.records == self.WRITE

	def modify(self, records='current'):
		"""Modify this connections's permissions."""
		if records != 'current':
			if records == None:
				self.records = 0
			else:
				self.records = records

	def __eq__(self, other):
		return self.records == other.records


class Config(object):
	"""Server configuration framework."""
	def __init__(self, dbpath, server_name='vetclix-server', port=6060):
		self._dbpath = str(dbpath)
		self._server_name = str(server_name)
		self._port = int(port)
		self._users = {}

	@property
	def dbpath(self):
		"""Return the path to the database."""
		return self._dbpath

	@property
	def server_name(self):
		"""Get the name of the server to advertise over the network."""
		return self._server_name

	@property
	def port(self):
		"""Get the port to listen on."""
		return self._port

	def add_user(self, user, password, perm):
		"""Add a user with a password to match and a Permissions object."""
		self._users[user] = (password, perm)

	def get_permissions(self, user, password):
		"""Return a permissions object giving a user's rights."""
		try:
			user_password, perm = self._users[user]
			if user_password == password:
				return copy.copy(perm)
		except KeyError:
			pass

		return Permissions()


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
				return vetmarshal.error('malformed')

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


def make_server(config, test_messages=()):
	"""Create and return a server with the given configuration data.  A
		sequence of test message/correct response pairs may be given for
		testing, in which case None will be returned."""
	vetdb = database.Database(config.dbpath)

	def handle_auth(ctx, request):
		"""Handle an authentication request."""
		user, password = request
		perm = config.get_permissions(user, password)
		ctx['auth'] = perm
		return vetmarshal.permissions(perm)
		return vetmarshal.error('badauth')

	def handle_get(ctx, request):
		"""Handle a record retrieval request."""
		rectype = request[0]
		recid = request[1]

		if rectype == 'client':
			client = vetdb.get_client(recid)

			if not client:
				return vetmarshal.error('nomatch')

			return vetmarshal.client(client)
		elif rectype == 'patient':
			patient = vetdb.get_patient(recid)

			if not patient:
				return vetmarshal.error('nomatch')

			return vetmarshal.patient(patient)
		else:
			return vetmarshal.error('badrequest')

	def handle_set(ctx, request):
		"""Handle setting a record."""
		rectype = request[0]
		recid = request[1]

		if rectype == 'client':
			client = vetmarshal.parse_client(request[1:])
			vetdb.set_client(client)
			return vetmarshal.success()
		elif rectype == 'patient':
			patient = vetmarshal.parse_patient(request[1:])
			vetdb.set_patient(patient)
			return vetmarshal.success()

	def dispatch(ctx, request):
		"""Dispatch a request to the appropriate handler."""
		auth = ctx['auth']
		command = request[0]
		body = []

		if len(request) > 1:
			body = request[1:]

		handlers = {'version?': (lambda auth: True, lambda ctx, req: VERSION),
					'auth': (lambda auth: True, handle_auth),
					'get': (lambda auth: auth.can_read_records, handle_get),
					'set': (lambda auth: auth.can_write_records, handle_set),
					'search': (lambda auth: auth.can_read_records, None)}

		handler = handlers[command]
		if handler[0](auth):
			return handler[1](ctx, body)

		return vetmarshal.error('badauth')

	if test_messages:
		ctx = {'auth': Permissions()}
		for message in test_messages:
			assert dispatch(ctx, message[0]) == message[1]
		vetdb.close()
		return None

	port = int(config['server'][1])
	handler = make_handler(dispatch)
	server = NetServer('localhost', port, handler)

	return server


def main():
	config = Config('foo.db')
	server = make_server(config)
	server.serve_forever()

if __name__ == '__main__':
	main()
