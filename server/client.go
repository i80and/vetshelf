package main

import (
	"errors"
	"fmt"
	"sort"
)

type ClientID string

type PhoneInfo struct {
	Number string `json:"number",bson:"number"`
	Note   string `json:"note",bson:"note"`
}

type ResponseClient struct {
	Type    string      `json:"type"`
	ID      ClientID    `json:"id"`
	Name    string      `json:"name"`
	Phone   []PhoneInfo `json:"phone"`
	Email   string      `json:"email"`
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
		Phone:   []PhoneInfo{},
		Address: data["address"].(string),
		Email:   data["email"].(string),
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

	for _, rawPhone := range data["phone"].([]interface{}) {
		switch rawPhone.(type) {
		case map[string]interface{}:
			phoneMap := rawPhone.(map[string]interface{})
			phone := PhoneInfo{
				Number: phoneMap["number"].(string),
				Note:   phoneMap["note"].(string),
			}
			client.Phone = append(client.Phone, phone)
		default:
			return nil, errors.New(fmt.Sprintf("Incorrect phone info: %v", rawPhone))
		}
	}

	return client, nil
}

func (c *ResponseClient) ToRealClient(conn *Connection) (*DatabaseClient, error) {
	client := DatabaseClient{
		Type:    "client",
		ID:      c.ID,
		Name:    c.Name,
		Phone:   c.Phone,
		Email:   c.Email,
		Address: c.Address,
		Pets:    c.Pets,
		Note:    c.Note}

	return &client, nil
}

type DatabaseClient struct {
	ID      ClientID     `bson:"_id"`
	Type    DocumentType `bson:"type"`
	Name    string       `bson:"name"`
	Phone   []PhoneInfo  `bson:"phone"`
	Email   string       `bson:"email"`
	Address string       `bson:"address"`
	Pets    []PatientID  `bson:"pets"`
	Note    string       `bson:"note"`
}

func (p *DatabaseClient) ToResponse(connection *Connection) (*ResponseClient, error) {
	response := ResponseClient{
		Type:    "client",
		ID:      p.ID,
		Name:    p.Name,
		Phone:   p.Phone,
		Email:   p.Email,
		Address: p.Address,
		Pets:    p.Pets,
		Note:    p.Note}

	return &response, nil
}

type clientSorter struct {
	values []DatabaseClient
	by     func(p1, p2 *DatabaseClient) bool
}

func (s *clientSorter) Len() int {
	return len(s.values)
}

func (s *clientSorter) Swap(i, j int) {
	s.values[i], s.values[j] = s.values[j], s.values[i]
}

func (s *clientSorter) Less(i, j int) bool {
	return s.by(&s.values[i], &s.values[j])
}

// Sort a list of DatabaseClient instances using the given comparison function.
func SortClients(values []DatabaseClient, by func(p1, p2 *DatabaseClient) bool) {
	sorter := clientSorter{values: values, by: by}
	sort.Sort(&sorter)
}
