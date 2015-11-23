package main

import (
	"errors"
	"fmt"
	"sort"
	"time"
)

const ISOTime = time.RFC3339

type VisitID string

type ResponseVisit struct {
	ID    VisitID  `json:"id"`
	Date  string   `json:"date"`
	Tasks []string `json:"tasks"`
	Note  string   `json:"note"`
}

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

	return visit, nil
}

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

type DatabaseVisit struct {
	ID      VisitID    `bson:"id"`
	RawDate string     `bson:"date"`
	Tasks   []TaskName `bson:"tasks"` // MUST be sorted!
	Note    string     `bson:"note"`
}

func (v *DatabaseVisit) Date() (time.Time, error) {
	date, err := time.Parse(ISOTime, v.RawDate)
	if err != nil {
		return time.Time{}, err
	}

	return date, nil
}

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

func (v *DatabaseVisit) HasTask(task TaskName) bool {
	for _, curTask := range v.Tasks {
		if curTask == task {
			Info.Printf("Found task %s", task)
			return true
		}
	}

	return false
}
