#!/usr/bin/env python

import doctest
import os

doctest.testfile('_test/tests.txt')
os.remove('foo.db')
