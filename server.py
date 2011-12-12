#!/usr/bin/env python
"""Module for creating and working with the components of a Vetclix network
server."""

import copy
import tornado.ioloop
import tornado.web
import database
import vetmarshal

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'

VERSION = 1


class Permissions(object):
	"""Class representing a connection's permissions."""
	READ = 1
	WRITE = 2

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


class VetclixHandler(tornado.web.RequestHandler):
	"""Base class for Vetclix request handlers, initiating data."""
	def initialize(self, database, config):
		self.vetdb = database
		self.config = config

	def write_error(self, status_code, **kwargs):
		"""Return an error code."""
		msg = status_code
		if 'msg' in kwargs:
			msg = kwargs['msg']
		self.write({'error': msg})


class VersionHandler(VetclixHandler):
	def get(self):
		self.write(str(VERSION))


class ClientHandler(VetclixHandler):
	"""Handle requests to the /client/ tree."""
	def get(self, id):
		pass

	def post(self, id):
		pass


class PatientHandler(VetclixHandler):
	"""Handle requests to the /patient/ tree."""
	def get(self, id):
		pass

	def post(self, id):
		pass


class SearchHandler(VetclixHandler):
	"""Handle search requests at /search"""
	def get(self):
		pass


class BadHandler(VetclixHandler):
	"""404 handler"""
	def get(self):
		self.send_error(status_code=404, msg='badrequest')


class Server(object):
	"""The main Vetclix server object."""
	def __init__(self, config):
		self.config = config
		self.database = database.Database(config.dbpath)
		args = dict(database=self.database, config=self.config)
		self.app = tornado.web.Application([
			(r'/version', VersionHandler, args),
			(r'/client/(.*)', ClientHandler, args),
			(r'/patient/(.*)', PatientHandler, args),
			(r'/search', SearchHandler, args),
			(r'/.*', BadHandler, args)
		])

	def start(self):
		"""Begin accepting connections."""
		self.app.listen(self.config.port)
		tornado.ioloop.IOLoop.instance().start()


def main():
	config = Config('foo.db')
	server = Server(config)
	server.start()

if __name__ == '__main__':
	main()
