import os
import uuid
import database


def make_bob():
	return database.Client('Bobby Tables',
							address='4982 New Appledam, Fairsworth',
							recid='73c3a3fd-9def-4154-9f4a-067069b58d5e')


def make_ruff():
	return database.Patient('Ruff',
							recid='63c8b75a-ea00-4c07-ac81-5ef75d3db298',
							species='Canine',
							breed='Labrador',
							description='Chocolate labrador, 80 lbs, black splotch on left eye.',
							gender='Neutered')


def test_tags():
	tags = database.tokenize(['Bobby Tables, 4982 New Appledam. bobtables@example.com, 612-555-2315.', 'This is a mysterious client indeed'])
	assert tags == {'bobby', 'tables', '4982', 'new', 'appledam', 'bobtables@example.com', '612-555-2315', 'this', 'is', 'a', 'mysterious', 'client', 'indeed'}


def test_client():
	bob = make_bob()

	bob.add_contact_info(('612-555-2315', 'phone', 'Home (preferred)'))
	bob.add_contact_info(('bobtables@example.com', 'email', ''))
	bob.add_contact_info(('612-555-8914', 'phone', 'Work'))
	bob.remove_contact_info(('612-555-8914', 'phone', 'Work'))

	assert bob.name == 'Bobby Tables'
	assert bob.tags == {'bobby', 'tables', '4982', 'new', 'appledam', 'fairsworth', '612-555-2315', 'bobtables@example.com'}
	assert bob.get_column_data() == (('recid', '73c3a3fd-9def-4154-9f4a-067069b58d5e'), ('name', 'Bobby Tables'), ('address', '4982 New Appledam, Fairsworth'))

	han = database.Client('Han Solo')
	assert uuid.UUID(han.recid)


def test_patient():
	ruff = make_ruff()
	assert ruff.get_column_data() == (('recid', '63c8b75a-ea00-4c07-ac81-5ef75d3db298'), ('name', 'Ruff'), ('species', 'Canine'), ('breed', 'Labrador'), ('gender', 'Neutered'), ('description', 'Chocolate labrador, 80 lbs, black splotch on left eye.'))
	assert ruff.tags == {'ruff', 'canine', 'labrador', 'chocolate', '80', 'lbs', 'black', 'splotch', 'on', 'left', 'eye', 'neutered'}


def test_database():
	db = database.Database('foo.db')
	bob = make_bob()
	ruff = make_ruff()

	bob.add_pet(ruff)
	db.set_patient(ruff)
	db.set_client(bob)

	db.close()
	os.remove('foo.db')
