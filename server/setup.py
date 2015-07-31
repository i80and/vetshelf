#!/usr/bin/env python3

from setuptools import setup

setup(name='vetclix',
      packages=['vetclix'],
      entry_points={
          'console_scripts': [
              'vetclix-server=vetclix.server:main'
          ]
      },
      install_requires=['tornado', 'motor']
)
