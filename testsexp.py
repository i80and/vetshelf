#!/usr/bin/env python
import sexp

tests = {
	'integer atom': (r'9053', 9053, lambda parsed: isinstance(parsed, int)),
	'float atom': (r'30.54', 30.54, lambda parsed: isinstance(parsed, float)),
	'string atom': (r'"This is the tale of an \"elephant\""', 'This is the tale of an "elephant"'),
	'empty string atom': (r'""', ''),
	'empty list': (r'()', []),
	'complex list': (r'(25.9 "Foobar" 40 ("nice b\"ob" ("foo" 40) "bar"))', [25.9, 'Foobar', 40, ['nice b"ob', ['foo', 40], 'bar']])
}

for test in tests:
	str_form = tests[test][0]
	parsed_form = tests[test][1]

	print('Testing {0}'.format(test))
	parsed = sexp.parse(str_form)
	dumped = sexp.dump(parsed_form)
	assert parsed == parsed_form
	assert dumped == str_form
	assert sexp.dump(sexp.parse(dumped)) == dumped

	# Extra test if provided
	if len(tests[test]) > 2:
		assert tests[test][2](parsed)

print('Testing abnormal seperators')
parsed = sexp.parse(r'("foo""bar" (90(30)))')
assert parsed == ['foo', 'bar', [90, [30]]]

print('Testing unclosed list 1')
error = False
try:
	parsed = sexp.parse(r'(40 (30')
except(sexp.UnclosedList):
	error = True
assert error

print('Testing unclosed list 2')
error = False
try:
	parsed = sexp.parse(r'("Foobar" ("this" "is")')
except(sexp.UnclosedList):
	error = True
assert error

# XXX: Unmatched closing parens are currently silently ignored.  This is a bug,
# but we don't want behavior changing unexpectedly
print('Testing against unmatched closing paren behavior change')
parsed = sexp.parse(r'())')
assert parsed == []
