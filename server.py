#!/usr/bin/env python

import sexp
import socket
import asyncore

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'


def create_handler_class(database):
	class Handler(asyncore.dispatcher):
		def __init__(self, sock, client_addr, server):
			self.server = server
			self.client = client_addr
			self.buffer = ''

			self.is_writable = False
			asyncore.dispatcher.__init__(self, sock)

		def writable(self):
			return self.is_writable

		def handle_read(self):
			data = self.recv(1024)
			if data:
				self.buffer += str(data, 'utf-8')
				self.is_writable = True

		def handle_write(self):
			if self.buffer:
				sent_len = self.send(bytes(self.buffer.upper(), 'utf-8'))
				self.is_writable = False
				self.buffer = ''

				if sent_len < len(bytes(self.buffer, 'utf-8')):
					print('Not all there')

		def handle(self):
			request = self.request.recv(1024)
			self.request.send(request)
			print(request)

	return Handler


class Server(asyncore.dispatcher):
	def __init__(self, dbpath, host, port):
		asyncore.dispatcher.__init__(self)

		self.handler_class = create_handler_class(dbpath)
		self.create_socket(socket.AF_INET, socket.SOCK_STREAM)

		self.bind((host, port))
		self.listen(5)

	def serve_forever(self):
		asyncore.loop()

	def handle_accept(self):
		(sock, client_addr) = self.accept()
		self.handler_class(sock, client_addr, self)

if __name__ == '__main__':
	s = Server('foo.db', 'localhost', 6060)
	s.serve_forever()
