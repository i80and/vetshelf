#!/usr/bin/env python
"""A set of utility functions for dealing with the Vetclix network API
after the s-expressions have been parsed."""

import database
import sexp


def error(code):
	"""Return an error code with a short string description."""
	return ['error', str(code)]


def parse_error(err):
	"""Parse an error to get its code."""
	return str(err[1])


def success():
	"""Return a success code."""
	return ['ok']


def permissions(perm):
	"""Serialize a permissions object."""
	return [perm.records]


def client(obj):
	"""Serialize a client object."""
	data = ['client', obj.recid, obj.name, obj.address]
	data.extend(obj.pets)
	data.extend(obj.contactinfo)
	data.append([])

	return data


def parse_client(data):
	"""Parse a client structure into an object."""
	structured = sexp.structure(data, ['recid', 'name', 'address', 'pets',
									'contactinfo', 'notes'])
	client_obj = database.Client(structured['name'], recid=structured['recid'],
								address=structured['address'])
	client_obj.pets = set([str(petid) for petid in structured['pets']])
	for contactrecord in structured['contactinfo']:
		client_obj.add_contact_info(contactrecord)
	client_obj.notes = [str(note) for note in structured['notes']]

	return client_obj


def patient(obj):
	"""Serialize a patient object."""
	data = ['patient', obj.recid, obj.name, obj.species,
			obj.breed, obj.gender, obj.description]
	data.append([])

	return data


def parse_patient(data):
	"""Parse a patient structure into an object."""
	structured = sexp.structure(data,
							['recid', 'name', 'species', 'breed',
							'gender', 'description', 'notes'])
	patient_obj = database.Patient(structured['name'], recid=structured['recid'],
								species=structured['species'],
								breed=structured['breed'],
								gender=structured['gender'],
								description=structured['description'])
	patient_obj.notes = [str(note) for note in structured['notes']]

	return patient_obj
