import re
import uuid

from typing import List, Iterable, Dict, Any, Set

SYNONYMNS = {
    'cat': 'feline',
    'dog': 'canine',
    'neutered': ('male', 'fixed'),
    'neuter': ('male', 'fixed'),
    'spayed': ('female', 'fixed'),
    'spay': ('female', 'fixed'),
    'rabbit': 'lagomorph',
    'bunny': 'lagomorph',
    'lagomorpha': 'lagomorph',
    'rat': ('rat', 'rodent'),
    'mouse': ('mouse', 'rodent'),
    'gsd': ('german shepherd', 'canine'),
    'lab': 'labrador',
    'calico': ('calico', 'feline'),
    'deceased': 'inactive',
    'dead': 'inactive'
}

PUNCTUATION_PAT = re.compile('[\.!?,\'":;]')


def normalize_query(query: str) -> List[str]:
    orig_terms = query.split()
    terms = [] # type: List[str]

    for term in orig_terms:
        term = term.lower()
        term = PUNCTUATION_PAT.sub('', term)
        subs = SYNONYMNS.get(term, term)
        if isinstance(subs, str):
            terms.append(subs)
        elif isinstance(subs, Iterable):
            terms.extend(subs)

    return terms


class Client:
    def __init__(self, recid: str=None, options=None) -> None:
        if options is None:
            options = {}

        self.recid = recid
        self.name = options.get('name', '')
        self.address = options.get('address', '')
        self.pets = set(options.get('pets', ()))
        self.note = options.get('note', '')

        self.version = options.get('version', 0)

        if self.recid is None:
            self.recid = uuid.uuid4().hex

    def serialize(self) -> Dict[str, Any]:
        return {
            'type': 'client',
            'id': self.recid,
            'name': self.name,
            'address': self.address,
            'pets': list(self.pets),
            'note': self.note,
            'version': self.version
        }

    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> 'Client':
        return cls(data['id'], data)

    def get_search_document(self) -> List[str]:
        components = [self.recid, self.name, self.address, self.note]
        tags = [] # type: List[str]
        for term in components:
            tags.extend(normalize_query(str(term)))
        return tags


class Patient:
    def __init__(self, recid: str=None, options=None) -> None:
        if options is None:
            options = {}

        self.recid = recid
        self.name = options.get('name', '')
        self.sex = options.get('sex', '')
        self.species = options.get('species', '')
        self.breed = options.get('breed', '')
        self.description = options.get('description', '')
        self.note = options.get('note', '')
        self.active = bool(options.get('active', False))

        self.version = options.get('version', 0)

        if self.recid is None:
            self.recid = uuid.uuid4().hex

    def serialize(self) -> Dict[str, Any]:
        return {
            'type': 'patient',
            'id': self.recid,
            'name': self.name,
            'sex': self.sex,
            'species': self.species,
            'breed': self.breed,
            'description': self.description,
            'note': self.note,
            'active': self.active,
            'version': self.version
        }

    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> 'Patient':
        return cls(data['id'], data)

    def get_search_document(self) -> List[str]:
        components = [self.recid, self.name, self.species, self.breed, self.description, self.note]
        sex, intact = self.sex

        if sex == 'm':
            components.append('male')
        elif sex == 'f':
            components.append('female')

        if intact == '+':
            components.append('intact')
        elif intact == '-':
            components.append('fixed')

        components.append('active' if self.active else 'inactive')

        tags = [] # type: List[str]
        for term in components:
            tags.extend(normalize_query(str(term)))
        return tags


class SearchResults:
    def __init__(self) -> None:
        self.clients = set() # type: Set[Client]
        self.patients = set() # type: Set[Patient]
        self.matched_patients = set() # type: Set[str]

    def serialize(self) -> Dict[str, Any]:
        return {
            'type': 'search-results',
            'clients': [c.serialize() for c in self.clients],
            'patients': [p.serialize() for p in self.patients],
            'matched-patients': list(self.matched_patients)
        }

    def add_client(self, client: Client) -> None:
        self.clients.add(client)

    def add_matched_patient(self, recid: str) -> None:
        self.matched_patients.add(recid)

    def add_patient(self, patient: Patient) -> None:
        self.patients.add(patient)

    def get_missing_patients(self) -> Set[str]:
        results = set() # type: Set[str]
        for client in self.clients:
            for petID in client.pets:
                results.add(petID)

        return results


class DummyConnection:
    def __init__(self, testing_mode: bool=False) -> None:
        self.testing_mode = testing_mode
        self.clients = {} # type: Dict[str, Client]
        self.patients = {} # type: Dict[str, Patient]

        max_cat = self.save_patient(Patient(None, {
            'name': 'Max', 'sex': 'm-', 'species': 'Feline',
            'breed': 'Domestic Shorthair', 'active': True}))
        florance = self.save_patient(Patient(None, {
            'name': 'Florance', 'sex': 'f+', 'species': 'Canine',
            'breed': 'Mixed', 'active': True}))
        betta = self.save_patient(Patient(None, {
            'name': 'Betta', 'sex': 'f-', 'species': 'Feline',
            'breed': 'Calico', 'active': True}))
        kiddo = self.save_patient(Patient(None, {
            'name': 'Kiddo', 'sex': 'f-', 'species': 'Feline',
            'breed': 'Domestic Shorthair', 'active': True}))

        self.save_client(Client(None, {
            'name': 'Bob Brillby',
            'address': '160 Gordonhurst Ave, Montclair NJ, 07043',
            'pets': [max_cat, florance, betta]}))
        self.save_client(Client(None, {
            'name': 'Bill "Snake Charmer"',
            'address': '140 Bellveue Ave, Montclair NJ, 07043',
            'pets': [kiddo]}))

    def search(self, query: str) -> SearchResults:
        query_set = set(normalize_query(query))

        results = SearchResults()
        for client in self.clients.values():
            client_search_document = set(client.get_search_document())
            if query_set.issubset(client_search_document):
                results.add_client(client)
                continue

            for petid in client.pets:
                patient = self.get_patient(petid)
                patient_search_document = set(patient.get_search_document())
                combined_search_document = patient_search_document.union(client_search_document)
                if query_set.issubset(combined_search_document):
                    results.add_client(client)
                    results.add_matched_patient(petid)

        for petID in results.get_missing_patients():
            results.add_patient(self.get_patient(petID))

        return results

    def get_upcoming(self) -> SearchResults:
        results = SearchResults()
        for client in self.clients.values():
            results.add_client(client)

        for petID in results.get_missing_patients():
            results.add_patient(self.get_patient(petID))

        return results

    def get_client(self, recid: str) -> Client:
        return self.clients[recid]

    def save_client(self, client: Client, no_overwrite: bool=False) -> str:
        if no_overwrite and client.recid in self.clients:
            raise KeyError('Duplicate client: {0}'.format(client.recid))

        self.clients[client.recid] = client
        return client.recid

    def save_patient(self, patient: Patient, no_overwrite: bool=False) -> str:
        if no_overwrite and patient.recid in self.patients:
            raise KeyError('Duplicate patient: {0}'.format(patient.recid))

        self.patients[patient.recid] = patient
        return patient.recid

    def get_patient(self, recid: str) -> Patient:
        return self.patients[recid]

    def add_patient_to_client(self, patient: Patient, clients: List[str]) -> None:
        for owner in clients:
            self.clients[owner].pets.add(patient.recid)

    def clear(self) -> None:
        if not self.testing_mode:
            raise ValueError('Cannot clear database without running in testing mode')

        self.clients.clear()
        self.patients.clear()

    def close(self) -> None:
        pass
