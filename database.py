#!/usr/bin/env python
import re
import sqlite3
import uuid

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'


class DatabaseException(Exception):
	"""Base exception class for database errors."""
	pass


class DatabaseTooNew(DatabaseException):
	"""On-disk database is too new for this client to open."""
	pass


TAG_STRIPPER = re.compile('[\W]$')


def tokenize(inputs):
	"""Split a list of input strings into a set of tags."""
	tags = set()
	for input in inputs:
		current = input.split()

		# TODO: This should be be a lot smarter
		current = [TAG_STRIPPER.sub('', tag.lower()) for tag in current]
		tags.update(current)

	return tags


class Record(object):
	# A pattern to find and eliminate punctuation at the end of words
	def __init__(self, name, recid='', notes=None):
		if not recid:
			recid = uuid.uuid4()

		if not notes:
			notes = []
		self.notes = notes

		self.recid = str(recid)
		self.name = str(name)


class Client(Record):
	def __init__(self, name, recid='', address=''):
		super().__init__(name, recid, [])
		self.address = str(address)

		self.pets = set()
		self.contactinfo = set()

	@property
	def tags(self):
		inputs = [str(contact[0]) for contact in self.contactinfo]
		inputs.extend(self.notes)
		inputs.extend([self.name, self.address])
		return tokenize(inputs)

	def get_column_data(self):
		"""Return a structure mapping client values to database columns."""
		return (('recid', self.recid), ('name', self.name), ('address', self.address))

	def add_pet(self, pet):
		"""Add a pet either by Patient or by ID."""
		try:
			recid = pet.recid
		except AttributeError:
			recid = str(pet)

		self.pets.update([recid])

	def remove_pet(self, pet):
		"""Remove a pet either by Patient or by ID."""
		try:
			recid = pet.recid
		except AttributeError:
			recid = str(pet)

		self.pets.remove(recid)

	def add_contact_info(self, info):
		"""Accepts a tuple (info, category, note) to store for contacting this client."""
		self.contactinfo.update(set([info]))

	def get_contact_info(self):
		"""Returns a set of all contact info."""
		return self.contactinfo.copy()

	def remove_contact_info(self, info):
		"""Remove a contact entry from this client."""
		self.contactinfo.remove(info)


class Patient(Record):
	def __init__(self, name, recid='', species='', breed='', gender='', description=''):
		super().__init__(name, recid, [])
		self.species = str(species)
		self.breed = str(breed)
		self.gender = str(gender)
		self.description = str(description)

	@property
	def tags(self):
		inputs = [self.name, self.species, self.breed, self.gender, self.description]
		inputs.extend(self.notes)
		return tokenize(inputs)

	def get_column_data(self):
		"""Return a structure mapping client values to database columns."""
		return (('recid', self.recid), ('name', self.name),
				('species', self.species), ('breed', self.breed),
				('gender', self.gender), ('description', self.description))


class Database(object):
	"""Vetclix database interface."""
	CLIENT_VERSION = 1

	def __init__(self, path):
		self.db = sqlite3.Connection(path)
		self._version = self.__getversion()

		if self.dbversion > self.CLIENT_VERSION:
			raise DatabaseTooNew

		self._upgrade()

	def __getversion(self):
		"""Retrieve the on-disk database schema version, returning 0 on error."""
		cursor = self.db.cursor()
		try:
			cursor.execute('select version from vetclix')
			result = cursor.fetchone()
			return int(result[0])
		except(sqlite3.DatabaseError):
			return 0

	def _upgrade(self):
		"""Upgrade the open database to the current schema."""
		cursor = self.db.cursor()

		def upgrade1():
			cursor.execute('create table clients(recid text primary key, ' +
							'name text, ' +
							'address text)')
			cursor.execute('create table contactinfo(clientid text, ' +
							'category text, ' +
							'data text, ' +
							'note text)')
			cursor.execute('create table patients(recid text primary key, ' +
							'name text, ' +
							'species text, ' +
							'breed text, ' +
							'gender text, ' +
							'description text)')
			cursor.execute('create table owns(ownerid text, patientid text)')
			cursor.execute('create index owns_index on owns(ownerid, patientid)')
			cursor.execute('create table tags(recid text, tag text)')
			cursor.execute('create index tag_index on tags(recid, tag)')
			cursor.execute('create table notes(recid text, note text)')
			cursor.execute('create index notes_index on tags(recid)')
			cursor.execute('create table vetclix(version int)')
			cursor.execute('insert into vetclix values(1)')
			self.db.commit()
			self._version = 1

		upgrades = [upgrade1]

		for upgrader in upgrades[self.dbversion:]:
			upgrader()

	def _set_tags(self, recid, tags):
		"""Update a record's search tags."""
		cursor = self.db.cursor()
		cursor.execute('delete from tags where recid=?', [str(recid)])
		for tag in tags:
			cursor.execute('insert into tags values(?, ?)', [str(recid), str(tag).lower()])

	def _set_contact_info(self, recid, contactinfo):
		"""Update a record's contact information."""
		cursor = self.db.cursor()
		cursor.execute('delete from contactinfo where clientid=?', [str(recid)])

		for field in contactinfo:
			cursor.execute('insert into contactinfo values(?, ?, ?, ?)',
							[str(recid)] + list(field))

	def _set_notes(self, record):
		"""Update a record's freeform notes.  Does not handle tags."""
		cursor = self.db.cursor()
		cursor.execute('delete from notes where recid=?', record.recid)
		for note in record.notes:
			cursor.execute('insert into notes values(?, ?)', record.recid, note)

	def _set_owns(self, ownerid, patientids):
		"""Assign the given patient IDs to this owner."""
		cursor = self.db.cursor()
		cursor.execute('delete from owns where ownerid=?', [ownerid])
		for patientid in patientids:
			cursor.execute('insert into owns values(?, ?)', [ownerid, patientid])

	@property
	def dbversion(self):
		"""Return a cached copy of the current database version."""
		return self._version

	def search(self, tags):
		"""Return a list of client record IDs related to the search terms."""
		# TODO: Sort by relevance based on appointment date and last-seen date
		cursor = self.db.cursor()

		# Set(tag1) intersect set(tag2) intersect ... intersect set(tagn)
		expression = ' intersect '.join(['select recid from tags where tag=?'] * len(tags))
		cursor.execute(expression, [tag.lower() for tag in tags])
		results = cursor.fetchall()
		return [result[0] for result in results]

	def _has_record(self, table, recid):
		"""Return whether or not the given record ID exists in the given table."""
		cursor = self.db.cursor()
		cursor.execute('select recid from {0} where recid=?'.format(table), [str(recid)])
		return bool(cursor.fetchone())

	def has_client(self, client):
		"""Return whether or not the given client exists in the database."""
		return self._has_record('clients', client.recid)

	def has_patient(self, patient):
		"""Return whether or not the given patient exists in the database."""
		return self._has_record('patients', patient.recid)

	def get_client(self, recid):
		"""Get a client from the database by UUID, returning None if not found."""
		cursor = self.db.cursor()
		cursor.execute('select * from clients where recid=?', [recid])
		result = cursor.fetchone()

		if not result:
			return None

		client = Client(result[1], address=result[2], recid=recid)

		# Get this client's pets
		cursor.execute('select patientid from owns where clientid=?', [recid])
		pets = cursor.fetchall()
		if not pets:
			pets = []
		client.pets = [row[0] for row in pets]

		return client

	def get_patient(self, recid):
		"""Get a patient from the database by UUID, returning None if not found."""
		cursor = self.db.cursor()
		cursor.execute('select * from patients where recid=?', [recid])
		result = cursor.fetchone()

		if not result:
			return None

		return Patient(result[1], recid=recid)

	def _set_record(self, table, recid, columndata):
		"""Asign a record in a table the given data tuple."""
		cursor = self.db.cursor()

		if self._has_record(table, recid):
			# Update the record
			placeholders = ', '.join(['{0}=?'.format(x[0]) for x in columndata])
			cursor.execute('update {0} set {1} where recid=?'.format(table, placeholders, recid),
							[x[1] for x in columndata] + [recid])
		else:
			# Insert a new record
			placeholders = ', '.join(['?'] * len(columndata))
			cursor.execute('insert into {0} values({1})'.format(table, placeholders),
							[x[1] for x in columndata])

	def set_client(self, client, autocommit=True):
		"""Store a client in the database."""
		columndata = client.get_column_data()
		self._set_record('clients', client.recid, columndata)

		self._set_tags(client.recid, client.tags)
		self._set_contact_info(client.recid, client.contactinfo)
		self._set_owns(client.recid, client.pets)

		if(autocommit):
			self.db.commit()

	def set_patient(self, patient, autocommit=True):
		"""Store a patient in the database."""
		columndata = patient.get_column_data()
		self._set_record('patients', patient.recid, columndata)

		if(autocommit):
			self.db.commit()

	def get_patient_owners(self, patient):
		"""Return a set of client IDs that own this patient."""
		cursor = self.db.cursor()
		cursor.execute('select ownerid from owns where patientid=?', [patient.recid])
		return set([owner[0] for owner in cursor.fetchall()])

	def close(self):
		"""Close the database and commit any unwritten changes."""
		self.db.commit()
		self.db.close()
