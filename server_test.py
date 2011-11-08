#!/usr/bin/env python
import os
import uuid
import server
import vetmarshal


def test_permissions():
	"""Test the connection permissions framework."""
	perm = server.Permissions()
	assert perm.can_read_records == False
	assert perm.can_write_records == False

	perm.modify()
	assert perm.can_read_records == False
	assert perm.can_write_records == False

	perm.modify(records=server.Permissions.READ)
	assert perm.can_read_records == True
	assert perm.can_write_records == False

	perm.modify(records=server.Permissions.WRITE)
	assert perm.can_read_records == True
	assert perm.can_write_records == True

	perm2 = server.Permissions()
	assert perm != perm2
	assert perm2 != perm

	perm2.modify(records=server.Permissions.WRITE)
	assert perm == perm2
	assert perm2 == perm


def test_dispatch():
	"""Test server response behavior."""
	config = server.Config(dbpath='foo.db')
	config.add_user('bob', 'notyetapassword',
					server.Permissions(records=server.Permissions.WRITE))

	noperm = server.Permissions()
	fullperm = server.Permissions(records=server.Permissions.WRITE)
	messages = (
		(['version?'], 1),
		(['auth', 'jil', 'notyetapassword'], vetmarshal.permissions(noperm)),
		(['auth', 'bob', 'wrongpassword'], vetmarshal.permissions(noperm)),
		(['get', 'client', str(uuid.uuid4())], vetmarshal.error('badauth')),
		(['auth', 'bob', 'notyetapassword'], vetmarshal.permissions(fullperm)),
		(['get', 'client', str(uuid.uuid4())], vetmarshal.error('nomatch')))
	server.make_server(config, messages)
	os.remove('foo.db')
