package main

import (
	"errors"
	"fmt"

	"gopkg.in/mgo.v2"
)

type ClientID string

type ResponseClient struct {
	Type    string      `json:"type"`
	ID      ClientID    `json:"id"`
	Name    string      `json:"name"`
	Address string      `json:"address"`
	Pets    []PatientID `json:"pets"`
	Note    string      `json:"note"`
}

func DeserializeResponseClient(data map[string]interface{}) (ret *ResponseClient, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = errors.New(fmt.Sprintf("Failed to deserialize client: '%v': %v", data, r))
			ret = nil
		}
	}()

	t := data["type"].(string)
	if t != "client" {
		return nil, errors.New(fmt.Sprintf("Incorrect client type: %s", t))
	}

	client := &ResponseClient{
		Type:    t,
		ID:      ClientID(data["id"].(string)),
		Name:    data["name"].(string),
		Address: data["address"].(string),
		Pets:    []PatientID{},
		Note:    data["note"].(string)}

	for _, rawID := range data["pets"].([]interface{}) {
		switch rawID.(type) {
		case string:
			client.Pets = append(client.Pets, PatientID(rawID.(string)))
		default:
			return nil, errors.New(fmt.Sprintf("Incorrect patient ID type: %v", rawID))
		}
	}

	return client, nil
}

func (c *ResponseClient) ToRealClient(conn *Connection) (*DatabaseClient, error) {
	client := DatabaseClient{
		Type:    "client",
		ID:      c.ID,
		Name:    c.Name,
		Address: c.Address,
		Pets:    c.Pets,
		Note:    c.Note}

	return &client, nil
}

type DatabaseClient struct {
	ID      ClientID     `bson:"_id"`
	Type    DocumentType `bson:"type"`
	Name    string       `bson:"name"`
	Address string       `bson:"address"`
	Pets    []PatientID  `bson:"pets"`
	Note    string       `bson:"note"`
}

func (p *DatabaseClient) Save(collection *mgo.Collection) error {
	return nil
}

func (p *DatabaseClient) ToResponse(connection *Connection) (*ResponseClient, error) {
	response := ResponseClient{
		Type:    "client",
		ID:      p.ID,
		Name:    p.Name,
		Address: p.Address,
		Pets:    p.Pets,
		Note:    p.Note}

	return &response, nil
}
