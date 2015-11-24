package main

import (
	"time"

	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

type TaskName string
type DocumentType string

type SearchResults struct {
	Clients         []DatabaseClient
	MatchedPatients []PatientID
}

type Connection struct {
	Session *mgo.Session
	DB      *mgo.Database
	Tasks   map[TaskName]time.Duration
}

func Connect(hostname string) (*Connection, error) {
	session, err := mgo.Dial(hostname)
	if err != nil {
		return nil, err
	}

	db := session.DB("vetshelf")
	db.C("test").EnsureIndex(mgo.Index{
		Key:    []string{"visits.id"},
		Sparse: true,
		Unique: true})
	db.C("test").EnsureIndex(mgo.Index{
		Key:    []string{"visits.date"},
		Sparse: true})

	tasks := map[TaskName]time.Duration{
		"heartworm": time.Duration(4380) * time.Hour,
		"exam":      time.Duration(4380) * time.Hour}

	return &Connection{session,
		db,
		tasks}, nil
}

func (c *Connection) GetClients(ids []ClientID) ([]*DatabaseClient, error) {
	var clients []*DatabaseClient
	err := c.DB.C("test").Find(bson.M{"_id": bson.M{"$in": ids}, "type": "client"}).
		Limit(100).All(&clients)
	if err != nil {
		return nil, err
	}

	return clients, nil
}

func (c *Connection) GetPatients(ids []PatientID) ([]*DatabasePatient, error) {
	var patients []*DatabasePatient
	err := c.DB.C("test").Find(bson.M{"_id": bson.M{"$in": ids}, "type": "patient"}).
		Limit(100).All(&patients)
	if err != nil {
		return nil, err
	}

	return patients, nil
}

func (c *Connection) GetOwners(ids []PatientID) ([]DatabaseClient, error) {
	var clients []DatabaseClient

	err := c.DB.C("test").Find(bson.M{"type": "client", "pets": bson.M{"$in": ids}}).
		Limit(1000).
		All(&clients)
	if err != nil {
		return nil, err
	}

	// Sort the results so that clients are represented in the same order as
	// their first patient in ids.

	// First things first: create an index of patient -> index
	patientIndex := map[PatientID]int{}
	for i, patient := range ids {
		patientIndex[patient] = i
	}

	// Now do the sort
	SortClients(clients, func(clientA, clientB *DatabaseClient) bool {
		// The pet lists should never be zero-length, since these clients were
		// found from the patient list we were given.
		firstPatientA := len(patientIndex)
		firstPatientB := len(patientIndex)

		for _, patientID := range clientA.Pets {
			if patientIndex[patientID] < firstPatientA {
				firstPatientA = patientIndex[patientID]
			}
		}

		for _, patientID := range clientB.Pets {
			if patientIndex[patientID] < firstPatientB {
				firstPatientB = patientIndex[patientID]
			}
		}

		return firstPatientA < firstPatientB
	})

	return clients, nil
}

func (c *Connection) GetVisit(id VisitID) (*DatabaseVisit, error) {
	var visit DatabaseVisit
	err := c.DB.C("test").Find(bson.M{"id": id, "type": "visit"}).One(&visit)
	if err != nil {
		return nil, err
	}

	return &visit, nil
}

func (c *Connection) GetUpcoming() (*SearchResults, error) {
	var results SearchResults
	var rows []*DatabasePatient

	today := time.Now().Format(ISOTime)
	err := c.DB.C("test").Find(bson.M{"type": "patient", "visits.date": bson.M{"$gt": today}}).
		Sort("visits.date").
		Select(bson.M{"_id": 1}).
		Limit(100).
		All(&rows)
	if err != nil {
		return nil, err
	}

	patientIDs := []PatientID{}
	for _, patient := range rows {
		patientIDs = append(patientIDs, patient.ID)
	}

	results.Clients, err = c.GetOwners(patientIDs)
	if err != nil {
		return nil, err
	}

	results.MatchedPatients = patientIDs
	return &results, nil
}

func (c *Connection) Search(query string) (*SearchResults, error) {
	return nil, nil
}

func (c *Connection) SaveClient(client *DatabaseClient, isNewClient bool) error {
	if isNewClient {
		err := c.DB.C("test").Insert(client)
		if err != nil {
			return err
		}

		return nil
	}

	err := c.DB.C("test").Update(bson.M{"_id": client.ID, "type": "client"}, client)
	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) SavePatient(patient *DatabasePatient, isNewPatient bool) error {
	if isNewPatient {
		err := c.DB.C("test").Insert(patient)
		if err != nil {
			return err
		}

		return nil
	}

	err := c.DB.C("test").Update(bson.M{"_id": patient.ID, "type": "patient"}, patient)
	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) SetOwners(p PatientID, owners []ClientID) error {
	if len(owners) == 0 {
		return nil
	}

	err := c.DB.C("test").Update(
		bson.M{"_id": bson.M{"$in": owners}, "type": "client"},
		bson.M{"$addToSet": bson.M{"pets": p}})

	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) InsertVisit(patient PatientID, v *DatabaseVisit) error {
	err := c.DB.C("test").Update(
		bson.M{"_id": patient, "type": "patient"},
		bson.M{"$addToSet": bson.M{"visits": v}})

	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) UpdateVisit(v *DatabaseVisit) error {
	err := c.DB.C("test").Update(
		bson.M{"visits.id": v.ID, "type": "patient"},
		bson.M{"$set": bson.M{"visits.$": v}})

	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) Clear() error {
	_, err := c.DB.C("test").RemoveAll(bson.M{})

	if err != nil {
		return err
	}

	return nil
}

func (c *Connection) Close() {
	c.Session.Close()
}
