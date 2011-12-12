#!/usr/bin/env python
import server
import vetmarshal


def test_error():
	"""Test error code constructor/reader."""
	err = vetmarshal.error('test')
	assert err == ['error', 'test']
	assert vetmarshal.parse_error(err) == 'test'


def test_success():
	"""Test creation of a success code."""
	assert vetmarshal.success() == ['ok']


def test_permissions():
	"""Test construction of a permissions object"""
	no_perm = server.Permissions()
	read_perm = server.Permissions(records=server.Permissions.READ)
	write_perm = server.Permissions(records=server.Permissions.WRITE)

	for perm in ((no_perm, [0]), (read_perm, [1]), (write_perm, [2])):
		assert vetmarshal.permissions(perm[0]) == perm[1]


def test_verify():
	"""Test structure verification."""
	assert vetmarshal.verify([], [])
	assert vetmarshal.verify(['Bobby Tables', 10], [str, int])
