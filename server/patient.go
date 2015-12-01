package main

import (
	"errors"
	"fmt"
	"time"

	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

type PatientID string
type Sex string

type ResponsePatient struct {
	Type        string           `json:"type"`
	ID          PatientID        `json:"id"`
	Name        string           `json:"name"`
	Sex         string           `json:"sex"`
	Species     string           `json:"species"`
	Breed       string           `json:"breed"`
	Description string           `json:"description"`
	Active      bool             `json:"active"`
	Visits      []*ResponseVisit `json:"visits"`
	Note        string           `json:"note"`

	// Informational fields that will be ignored if provided by a client
	Due map[TaskName]string `json:"due"`

	Dirty []string `json:"omitempty,dirty"`
}

// Convert a string map that comes from a JSON parser and transform it into a
// protocol-level Patient.
func DeserializeResponsePatient(data map[string]interface{}) (ret *ResponsePatient, err error) {
	defer func() {
		if r := recover(); r != nil {
			Error.Println(r)
			err = errors.New(fmt.Sprintf("Failed to deserialize patient: '%v': %v", data, r))
			ret = nil
		}
	}()

	t := data["type"].(string)
	if t != "patient" {
		return nil, errors.New(fmt.Sprintf("Incorrect patient type: %s", t))
	}

	patient := &ResponsePatient{
		Type:        t,
		ID:          PatientID(data["id"].(string)),
		Name:        data["name"].(string),
		Sex:         data["sex"].(string),
		Species:     data["species"].(string),
		Breed:       data["breed"].(string),
		Description: data["description"].(string),
		Active:      data["active"].(bool),
		Visits:      []*ResponseVisit{},
		Note:        data["note"].(string)}

	for _, rawVisit := range data["visits"].([]interface{}) {
		switch rawVisit.(type) {
		case map[string]interface{}:
			visit, err := DeserializeResponseVisit(rawVisit.(map[string]interface{}))
			if err != nil {
				return nil, errors.New(fmt.Sprintf("Error parsing visit: %v", visit))
			}

			patient.Visits = append(patient.Visits, visit)
		default:
			return nil, errors.New(fmt.Sprintf("Bad visit type: %v", rawVisit))
		}
	}

	// Validate the given Sex
	_, err = VerifySex(patient.Sex)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Attempt to update patient with illegal sex \"%s\"", patient.Sex))
	}

	// If we're provided a dirty list, include it
	patient.Dirty = ExtractStringList(data, "dirty")

	return patient, nil
}

// Convert a protocol-level Patient into a database-level Patient.
func (p *ResponsePatient) ToRealPatient(conn *Connection) (*DatabasePatient, error) {
	sex, err := VerifySex(p.Sex)
	if err != nil {
		return nil, err
	}

	patient := DatabasePatient{
		Type:        "patient",
		ID:          p.ID,
		Name:        p.Name,
		RawSex:      sex,
		Species:     p.Species,
		Breed:       p.Breed,
		Description: p.Description,
		Active:      p.Active,
		Visits:      []*DatabaseVisit{},
		Note:        p.Note}

	for _, rawVisit := range p.Visits {
		realVisit, err := rawVisit.ToRealVisit(conn)
		if err != nil {
			return nil, err
		}

		patient.Visits = append(patient.Visits, realVisit)
	}

	return &patient, nil
}

// Create a BSON document from a protocol-level Patient structure's list of "dirty"
// fields, mapping modified keys to updated values.
func (p *ResponsePatient) CreateUpdateDocument() bson.M {
	changes := bson.M{}
	for _, key := range p.Dirty {
		var update interface{}
		switch key {
		case "name":
			update = p.Name
		case "sex":
			update = p.Sex
		case "species":
			update = p.Species
		case "breed":
			update = p.Breed
		case "description":
			update = p.Description
		case "active":
			update = p.Active
		case "note":
			update = p.Note
		default:
			Warning.Printf(fmt.Sprintf("Attempt to update unknown patient field %s", key))
			continue
		}

		changes[key] = update
	}

	return changes
}

type DatabasePatient struct {
	ID          PatientID        `bson:"_id"`
	Type        DocumentType     `bson:"type"`
	Name        string           `bson:"name"`
	RawSex      Sex              `bson:"sex"`
	Species     string           `bson:"species"`
	Breed       string           `bson:"breed"`
	Description string           `bson:"desc"`
	Active      bool             `bson:"active"`
	Visits      []*DatabaseVisit `bson:"visits"`
	Note        string           `bson:"note"`
}

// Returns either 'f' or 'm' depending on the sex of this patient.
func (p *DatabasePatient) Sex() rune {
	switch p.RawSex[0] {
	case 'm', 'f':
		return rune(p.RawSex[0])
	}

	// This should never happen, since our RawSex instance should only ever
	// come from VerifySex.
	panic(fmt.Sprintf("Unknown sex format: \"%s\"", p.RawSex))
}

// Returns true iff this patient's sex organs are known to be intact.
func (p *DatabasePatient) Intact() bool {
	switch p.RawSex[1] {
	case '+', '-':
		return p.RawSex[1] == '+'
	}

	return false
}

// Convert a Database Patient into a Protocol Patient for serialization.
func (p *DatabasePatient) ToResponse(connection *Connection) (*ResponsePatient, error) {
	response := ResponsePatient{
		Type:        "patient",
		ID:          p.ID,
		Name:        p.Name,
		Sex:         string(p.RawSex),
		Species:     p.Species,
		Breed:       p.Breed,
		Description: p.Description,
		Active:      p.Active,
		Visits:      []*ResponseVisit{},
		Note:        p.Note,
		Due:         map[TaskName]string{}}

	for _, visit := range p.Visits {
		visitResponse, err := visit.ToResponse(connection)
		if err != nil {
			return nil, err
		}

		response.Visits = append(response.Visits, visitResponse)
	}

	// Compute due dates
	for taskName, interval := range connection.Tasks {
		// For each task type, find the most recent
		lastVisit := p.LastVisitWithTask(taskName)

		if lastVisit == nil {
			response.Due[taskName] = time.Now().Format(ISOTime)
			continue
		}

		dueDate, err := lastVisit.Date()
		if err != nil {
			return nil, err
		}

		dueDate = dueDate.Add(interval)
		response.Due[taskName] = dueDate.Format(ISOTime)
	}

	return &response, nil
}

// Return the most recent Visit in which a given task was performed.
func (p *DatabasePatient) LastVisitWithTask(task TaskName) *DatabaseVisit {
	if len(p.Visits) == 0 {
		return nil
	}

	var bestMatch *DatabaseVisit
	for _, visit := range p.Visits {
		// Check if task was done
		if !visit.HasTask(task) {
			continue
		}

		// Check date
		if bestMatch == nil || visit.RawDate > bestMatch.RawDate {
			bestMatch = visit
		}
	}

	return bestMatch
}

// Save this patient into the given collection.
func (p *DatabasePatient) Save(collection *mgo.Collection) error {
	return nil
}

// Returns an error if the given sex string looks wrong. Otherwise returns the
// input as a "blessed" Sex instance.
func VerifySex(sex string) (Sex, error) {
	switch sex {
	case "m+", "m-", "m?", "f+", "f-", "f?", "?+", "?-", "??":
		return Sex(sex), nil
	}

	return "", errors.New(fmt.Sprintf("Incorrect sex format: '%s'", sex))
}
