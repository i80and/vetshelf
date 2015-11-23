package main

import (
	"time"

	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

type TaskName string
type DocumentType string

type SearchResults struct {
	Clients         []*DatabaseClient
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

func (c *Connection) GetVisit(id VisitID) (*DatabaseVisit, error) {
	var visit DatabaseVisit
	err := c.DB.C("test").Find(bson.M{"id": id, "type": "visit"}).One(&visit)
	if err != nil {
		return nil, err
	}

	return &visit, nil
}

func (c *Connection) GetUpcoming() (*SearchResults, error) {
	// TODO For now only return an arbitrary set of documents
	var results SearchResults
	var rows []*DatabaseClient

	err := c.DB.C("test").Find(bson.M{"type": "client"}).Limit(100).All(&rows)
	if err != nil {
		return nil, err
	}

	for _, client := range rows {
		results.Clients = append(results.Clients, client)
	}

	return &results, nil
}

func (c *Connection) GetPatientDueDates(patient *DatabasePatient) (map[TaskName]time.Time, error) {
	// TODO
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

func (c *Connection) Search(query string) (*SearchResults, error) {
	return nil, nil
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
