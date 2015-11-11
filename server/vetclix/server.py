#!/usr/bin/env python3

"""Vetclix Server.

Usage:
  vetclix-server
  vetclix-server [-p N] [-u UID -g GID] [--testing]
  vetclix-server -h | --help
  vetclix-server --version

Options:
  -h --help     Show this screen.
  -p port       Port to listen on. If using a port below 1024, you need to
                start this script as root, and use the -u and -g options to
                drop root permissions once the socket is open. [default: 80]
  -u uid        User to drop down to once the socket is open.
  -g gid        Group to drop down to once the socket is open.
  --testing     Start the server in testing mode, which allows potentially
                unsafe operations. [default: False]
"""

import json
import logging
import os
import sys

import docopt
import tornado.web
import tornado.websocket
from typing import List, Dict, Any

import vetclix.db
import vetclix.db.dummy

MAX_MESSAGE_LEN = 1024 * 1024
LOGGER = logging.getLogger(__name__)
logging.getLogger().setLevel(logging.INFO)


def int_or_none(n: str) -> int:
    """Return n in integer form if possible; otherwise, None."""
    try:
        return int(n)
    except TypeError:
        return None


class EchoWebSocket(tornado.websocket.WebSocketHandler):
    def initialize(self, dbconn: vetclix.db.dummy.DummyConnection) -> None:
        self.dbconn = dbconn

    def select_subprotocol(self, subprotocols: List[str]) -> str:
        if 'vetclix' not in subprotocols:
            return None

        return 'vetclix'

    def check_origin(self, origin: str) -> bool:
        return True

    def open(self) -> None:
        pass

    def on_message(self, message) -> None:
        if len(message) > MAX_MESSAGE_LEN:
            LOGGER.warn('Message too large: %s', len(message))
            return

        try:
            data = json.loads(message)
        except ValueError:
            LOGGER.info('Received invalid JSON')
            return

        try:
            messageCounter = int(data['i'])
        except (KeyError, IndexError, ValueError, TypeError):
            LOGGER.info('Received unknown message counter')
            return

        try:
            msg = data['m']
            method = msg[0]
            args = msg[1:]
        except Exception:
            return self.__reply(messageCounter, 'error')

        try:
            method = method.replace('-', '_')
            result = getattr(self, 'handle_' + method)(*args)
            return self.__reply(messageCounter, result)
        except Exception as err:
            LOGGER.exception(err)
            return self.__reply(messageCounter, 'error')

    def on_close(self) -> None:
        pass

    def handle_search(self, query: str) -> List[vetclix.db.SearchResults]:
        return self.dbconn.search(query).serialize()

    def handle_show_upcoming(self) -> List[vetclix.db.SearchResults]:
        return self.dbconn.get_upcoming().serialize()

    def handle_get_clients(self, recids: List[str]) -> List[vetclix.db.Client]:
        return [self.dbconn.get_client(recid).serialize() for recid in recids]

    def handle_get_patients(self, recids: List[str]) -> List[vetclix.db.Patient]:
        return [self.dbconn.get_patient(recid).serialize() for recid in recids]

    def handle_save_patient(self, raw_patient: List[str],
                            client_ids: List[str], no_overwrite: bool=False) -> str:
        patient = vetclix.db.Patient.deserialize(raw_patient)
        recid = self.dbconn.save_patient(patient, no_overwrite)
        self.dbconn.add_patient_to_client(patient, client_ids)
        return recid

    def handle_save_client(self, raw_client: Dict[str, Any], no_overwrite: bool=False) -> str:
        client = vetclix.db.Client.deserialize(raw_client)
        return self.dbconn.save_client(client, no_overwrite)

    def handle_save_visit(self, raw_visit: Dict[str, Any], no_overwrite: bool=False) -> str:
        visit = vetclix.db.Visit.deserialize(raw_visit)
        return self.dbconn.save_visit(visit, no_overwrite)

    def handle_clear(self) -> None:
        self.dbconn.clear()

    def __reply(self, messageCounter: int, message: Dict[str, Any]) -> None:
        self.write_message(json.dumps({
                'i': messageCounter,
                'm': message
            }))


def main() -> None:
    logging.basicConfig()
    arguments = docopt.docopt(__doc__, version='Vetclix Server 0.0')

    try:
        port = int(arguments['-p'])
        uid = int_or_none(arguments['-u'])
        gid = int_or_none(arguments['-g'])
        testing_mode = arguments['--testing']
    except ValueError:
        print(__doc__)
        sys.exit(1)

    if os.getuid() == 0 and (not uid or not gid):
        LOGGER.warn('Running as root! Please specify -u and -g.')

    if testing_mode:
        LOGGER.warn('Running in testing mode! Do not deploy in production.')

    dbconn = vetclix.db.dummy.DummyConnection(testing_mode)

    try:
        application = tornado.web.Application([
            (r'/', EchoWebSocket, dict(dbconn=dbconn)),
        ])
        application.listen(port)

        # Drop permissions
        if gid:
            os.setgid(gid)

        if uid:
            os.setuid(uid)

        LOGGER.info('Listening on port %s', port)
        tornado.ioloop.IOLoop.current().start()
    finally:
        dbconn.close()


if __name__ == '__main__':
    main()
