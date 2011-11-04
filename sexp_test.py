#!/usr/bin/env python
import sexp

TESTS = {
	'integer atom': (r'9053', 9053, lambda parsed: isinstance(parsed, int)),
	'float atom': (r'30.54', 30.54, lambda parsed: isinstance(parsed, float)),
	'string atom': (r'"This is the tale of an \"elephant\""', 'This is the tale of an "elephant"'),
	'empty string atom': (r'""', ''),
	'empty list': (r'()', []),
	'complex list': (r'(25.9 "Foobar" 40 ("nice b\"ob" ("foo" 40) "bar"))', [25.9, 'Foobar', 40, ['nice b"ob', ['foo', 40], 'bar']])
}


def test_generator():
	"""Generates simple positive tests."""
	def testcase(test):
		def inner():
			print(test)
			str_form = test[0]
			parsed_form = test[1]

			parsed = sexp.parse(str_form)
			dumped = sexp.dump(parsed_form)
			assert parsed == parsed_form
			assert dumped == str_form
			assert sexp.dump(sexp.parse(dumped)) == dumped

			# Extra test if provided
			if len(test) > 2:
				assert test[2](parsed)
		return inner

	for test in TESTS:
		yield testcase(TESTS[test])


def test_abornal_seperators():
	"""Test quirk where no space is necessary between list elements."""
	parsed = sexp.parse(r'("foo""bar" (90(30)))')
	assert parsed == ['foo', 'bar', [90, [30]]]


def test_unclosed_list_1():
	"""Ensure that an unclosed list gives an error."""
	error = False
	try:
		sexp.parse(r'(40 (30')
	except(sexp.UnclosedList):
		error = True
	assert error


def test_unclosed_list_2():
	"""Ensure that an unclosed list gives an error."""
	error = False
	try:
		sexp.parse(r'("Foobar" ("this" "is")')
	except(sexp.UnclosedList):
		error = True
	assert error


def test_unmatched_closing_paren():
	"""Ensure that excess closing parenthesis are ignored."""
	# XXX: Unmatched closing parens are currently silently ignored.  This is a bug,
	# but we don't want behavior changing unexpectedly
	parsed = sexp.parse(r'())')
	assert parsed == []

	parsed = sexp.parse(r'(("key" "value1" "value2") ("key2" "value"))')
	assert sexp.maplist(parsed) == {'key': ['value1', 'value2'], 'key2': 'value'}

	parsed = ['client', 'Bobby Tables', ['396-555-3213', 'bobtables@example.com']]
	structured = sexp.structure(parsed, ['type', 'name', 'contact'])
	assert structured == {'type': 'client',
							'name': 'Bobby Tables',
							'contact': ['396-555-3213', 'bobtables@example.com']}
