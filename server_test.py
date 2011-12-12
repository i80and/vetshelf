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
