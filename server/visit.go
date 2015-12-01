package main

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"gopkg.in/mgo.v2/bson"
)

const ISOTime = time.RFC3339

type VisitID string

type ResponseVisit struct {
	ID    VisitID  `json:"id"`
	Date  string   `json:"date"`
	Tasks []string `json:"tasks"`
	Note  string   `json:"note"`

	Dirty []string `json:"omitempty,dirty"`
}

// Convert a string map that comes from a JSON parser and transform it into a
// protocol-level Visit.
func DeserializeResponseVisit(data map[string]interface{}) (ret *ResponseVisit, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = errors.New(fmt.Sprintf("Failed to deserialize visit: '%v': %v", data, r))
			ret = nil
		}
	}()

	visit := &ResponseVisit{
		ID:    VisitID(data["id"].(string)),
		Date:  data["date"].(string),
		Tasks: []string{},
		Note:  data["note"].(string)}

	for _, task := range data["tasks"].([]interface{}) {
		visit.Tasks = append(visit.Tasks, task.(string))
	}

	// If we're provided a dirty list, include it
	visit.Dirty = ExtractStringList(data, "dirty")

	return visit, nil
}

// Convert a protocol-level Visit into a database-level Visit.
func (c *ResponseVisit) ToRealVisit(conn *Connection) (*DatabaseVisit, error) {
	// While we take dates in the same format as we store, round-trip our input
	// through the parser to make sure it's valid.
	date, err := time.Parse(ISOTime, c.Date)
	if err != nil {
		return nil, err
	}

	// Screw every timezone that isn't UTC.
	date = date.In(time.UTC)

	// Sort our tasks so we can do a fast membership check
	sort.Strings(c.Tasks)

	visit := DatabaseVisit{
		ID:      c.ID,
		RawDate: date.Format(ISOTime),
		Tasks:   []TaskName{},
		Note:    c.Note}

	for _, task := range c.Tasks {
		visit.Tasks = append(visit.Tasks, TaskName(task))
	}

	return &visit, nil
}

// Create a BSON document from a protocol-level Visit structure's list of "dirty"
// fields, mapping modified keys to updated values.
func (v *ResponseVisit) CreateUpdateDocument(keyPrefix string) bson.M {
	changes := bson.M{}
	for _, key := range v.Dirty {
		var update interface{}
		switch key {
		case "date":
			update = v.Date
		case "tasks":
			update = v.Tasks
		case "note":
			update = v.Note
		default:
			Warning.Printf(fmt.Sprintf("Attempt to update unknown visit field %s", key))
			continue
		}

		changes[keyPrefix+key] = update
	}

	return changes
}

type DatabaseVisit struct {
	ID      VisitID    `bson:"id"`
	RawDate string     `bson:"date"`
	Tasks   []TaskName `bson:"tasks"` // MUST be sorted!
	Note    string     `bson:"note"`
}

// Parse the stored raw date into a usable Time object.
func (v *DatabaseVisit) Date() (time.Time, error) {
	date, err := time.Parse(ISOTime, v.RawDate)
	if err != nil {
		return time.Time{}, err
	}

	return date, nil
}

// Convert a Database Visit into a Protocol Visit for serialization.
func (v *DatabaseVisit) ToResponse(connection *Connection) (*ResponseVisit, error) {
	visit := ResponseVisit{
		ID:    v.ID,
		Date:  v.RawDate,
		Tasks: []string{},
		Note:  v.Note}

	for _, task := range v.Tasks {
		visit.Tasks = append(visit.Tasks, string(task))
	}

	return &visit, nil
}

// Check whether the given task was performed during this Visit.
func (v *DatabaseVisit) HasTask(task TaskName) bool {
	for _, curTask := range v.Tasks {
		if curTask == task {
			return true
		}
	}

	return false
}
