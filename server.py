#!/usr/bin/env python
"""Module for creating and working with the components of a Vetclix network
server."""

# Please note: this is designed as a working prototype.  It isn't necessarily
# as elegant or as safe as I would like!

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

<<<<<<< HEAD

class PatientHandler(VetclixHandler):
	"""Handle requests to the /patient/ tree."""
	def get(self, id):
		pass

	def post(self, id):
		pass
=======
	def handle_setclient(ctx, request):
		"""Handle setting a client record."""
		client = vetmarshal.parse_client(request)
		vetdb.set_client(client)
		return vetmarshal.success()

	def handle_setpatient(ctx, request):
		"""Handle setting a patient record."""
		patient = vetmarshal.parse_patient(request)
		vetdb.set_patient(patient)
		return vetmarshal.success()

	def dispatch(ctx, request):
		"""Dispatch a request to the appropriate handler."""
		auth = ctx['auth']

		if len(request) < 1:
			return vetmarshal.error('badrequest')

		command = str(request[0])
		body = []
>>>>>>> 5d099b9636a065ffd676c19243e1cb4a8eb6ccee


<<<<<<< HEAD
class SearchHandler(VetclixHandler):
	"""Handle search requests at /search"""
	def get(self):
		pass

=======
		handlers = {'version?': ([], lambda auth: True, lambda ctx, req: VERSION),
					'auth': ([str, str], lambda auth: True, handle_auth),
					'get': ([str, str], lambda auth: auth.can_read_records, handle_get),
					'set-client': (vetmarshal.verify_client, lambda auth: auth.can_write_records, handle_setclient),
					'set-patient': (vetmarshal.verify_patient, lambda auth: auth.can_write_records, handle_setpatient),
					'search': ([str], lambda auth: auth.can_read_records, None)}

		if not command in handlers:
			return vetmarshal.error('badrequest')

		handler = handlers[command]
		handler_verify, handler_authf, handler = handler

		# Check request format.  handler_verify can either be a list of types
		# or a predicate function.
		invalid = False
		if hasattr(handler_verify, '__call__'):
			invalid = not handler_verify(body)
		else:
			invalid = not vetmarshal.verify(body, handler_verify)

		if invalid:
			return vetmarshal.error('badrequest')

		# Check permissions
		if handler_authf(auth):
			try:
				return handler(ctx, body)
			except:
				return vetmarshal.error('internal')
>>>>>>> 5d099b9636a065ffd676c19243e1cb4a8eb6ccee

class BadHandler(VetclixHandler):
	"""404 handler"""
	def get(self):
		self.send_error(status_code=404, msg='badrequest')

<<<<<<< HEAD
=======
	# Special hook for testing
	if test_messages:
		ctx = {'auth': Permissions()}
		for message in test_messages:
			response = dispatch(ctx, message[0])
			print(message[0], message[1], response)
			assert response == message[1]
		vetdb.close()
		return None
>>>>>>> 5d099b9636a065ffd676c19243e1cb4a8eb6ccee

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
