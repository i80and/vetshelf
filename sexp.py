#!/usr/bin/env python
"""A parser/recursive encoder for a very very simplified form of s-expression,
where only double-quoted escaped strings, ints, floats, and lists are handled."""

import re
import numbers

__author__ = 'Andrew Aldridge'
__license__ = 'ISC'
__email__ = 'i80and@gmail.com'

TOKEN_RE = re.compile('[\(\)\"0-9]')
ESCAPE_RE = re.compile('[\"\\\\]')

SEP_RE = re.compile('\s')
NUMBER_RE = re.compile('[0-9\.]+')


class SExpError(Exception):
	"""Base class for all s-expression parse/dump errors."""
	pass


class ParseError(SExpError):
	"""An error in s-expression parsing."""
	pass


class UnclosedList(ParseError):
	"""The s-expression passed to parse() has mismatched parenthesis."""
	pass


def parse(inputstr):
	"""Simple character-based state-machine parser."""
	def parsenum(buf):
		"""Parse a buffer of characters into an appropriate number type."""
		strnum = ''.join(buf)
		try:
			return int(strnum)
		except ValueError:
			return float(strnum)

	is_atomic = True
	state = []
	output = []
	lists = [[]]
	buf = []

	# This is my first state machine, so please pardon the messy code.  I'm
	# just kinda proud that it works.
	# TODO: Draw syntax diagram

	# Fill initial state
	if inputstr.startswith('"') and len(inputstr) > 1:
		state.append('STRING')
	elif inputstr.startswith('(') and len(inputstr) > 1:
		state.append('LIST')
		is_atomic = False
	elif NUMBER_RE.match(inputstr):
		state.append('NUMBER')
		buf.append(inputstr[0])
	else:
		return ''

	# States: STRING, ESCAPE, NUMBER, LIST
	for char in inputstr[1:]:
		if not state:
			break

		if state[-1] == 'STRING':
			if char == '"':
				state.pop()
				lists[-1].append(''.join(buf))

				buf = []
			elif char == '\\':
				# Transition to ESCAPE state
				state.append('ESCAPE')
			else:
				buf.append(char)
			continue
		elif state[-1] == 'ESCAPE':
			buf.append(char)
			# Transition back to STRING state
			state.pop()
			continue
		elif state[-1] == 'NUMBER':
			if not NUMBER_RE.match(char):
				# Transition back to LIST state
				# This transition may have to be processed on this
				# character, so we fall through to the LIST check.
				state.pop()
				num = parsenum(buf)
				lists[-1].append(num)
				buf = []
			else:
				buf.append(char)
				continue

		if state[-1] == 'LIST':
			if NUMBER_RE.match(char):
				# Transition to NUMBER state
				state.append('NUMBER')
				buf.append(char)
			elif char == '"':
				# Transition to STRING state
				state.append('STRING')
			elif char == '(':
				# Transition to a nested LIST state
				state.append('LIST')
				lists.append([])
			elif char == ')':
				# Transition back to parent state
				state.pop()
				curlist = lists.pop()
				if lists:
					lists[-1].append(curlist)
				else:
					output.append(curlist)
			else:
				# Element seperator
				continue

	if is_atomic:
		# Number atoms don't have a terminating character, leaving the buffer
		# unflushed.
		if buf:
			return parsenum(buf)
		# Handle string atoms
		return lists.pop()[0]

	if len(lists) > 0:
		raise UnclosedList

	return output[0]


def dump(data):
	"""Dump a Python tree into an s-expression string."""
	def escape(match):
		"""Encode special characters in strings."""
		return '\\' + match.group(0)

	def innerdump(curdata):
		if isinstance(curdata, numbers.Number):
			return str(curdata)
		elif isinstance(curdata, (list, tuple)):
			output = []
			for entry in curdata:
				output.append(innerdump(entry))
			return '(' + ' '.join(output) + ')'
		else:
			escaped = ESCAPE_RE.sub(escape, str(curdata))
			return '"' + escaped + '"'

	return innerdump(data)
