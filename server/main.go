package main

import (
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/user"
	"strconv"
	"syscall"

	"github.com/gorilla/websocket"
)

var (
	Info    *log.Logger
	Warning *log.Logger
	Error   *log.Logger
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	Subprotocols:    []string{"vetclix"},
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

type Message struct {
	MessageID uint64      `json:"i"`
	Message   interface{} `json:"m"`
}

type ResponseSearchResults struct {
	Type           string             `json:"type"`
	Clients        []*ResponseClient  `json:"clients"`
	Patients       []*ResponsePatient `json:"patients"`
	Visits         []*ResponseVisit   `json:"visits"`
	PatientMatches []PatientID        `json:"matched-patients"`
}

func NewResults() *ResponseSearchResults {
	var result ResponseSearchResults
	result.Type = "search-results"
	result.Clients = []*ResponseClient{}
	result.Patients = []*ResponsePatient{}
	result.Visits = []*ResponseVisit{}
	result.PatientMatches = []PatientID{}

	return &result
}

func (r *ResponseSearchResults) LoadPatients(conn *Connection) error {
	patientIDs := []PatientID{}
	for _, client := range r.Clients {
		for _, patientID := range client.Pets {
			patientIDs = append(patientIDs, patientID)
		}
	}

	patients, err := conn.GetPatients(patientIDs)
	if err != nil {
		Error.Printf("Error loading patients: %v", err)
		return err
	}

	r.Patients = []*ResponsePatient{}
	for _, patient := range patients {
		response, err := patient.ToResponse(conn)
		if err != nil {
			Error.Printf("Error converting patient %s to response: %v", patient.ID, err)
			continue
		}

		r.Patients = append(r.Patients, response)
	}

	return nil
}

type Application struct {
	Testing    bool
	Connection *Connection
}

func CreateApplication(hostname string, testing bool) (*Application, error) {
	connection, err := Connect(hostname)
	if err != nil {
		return nil, err
	}

	return &Application{testing, connection}, nil
}

func (a *Application) HandleSearch(args []interface{}, out *Message) {
	query := args[0]
	switch query.(type) {
	case string:
		query = query.(string)
	default:
		return
	}
}

func (a *Application) HandleShowUpcoming(args []interface{}, out *Message) {
	upcoming, err := a.Connection.GetUpcoming()
	if err != nil {
		Error.Printf("%v", err)
		return
	}

	results := NewResults()

	for _, client := range upcoming.Clients {
		response, err := client.ToResponse(a.Connection)
		if err != nil {
			Error.Printf("Error converting client %s to response: %v", client.ID, err)
			continue
		}

		results.Clients = append(results.Clients, response)
	}

	err = results.LoadPatients(a.Connection)
	if err != nil {
		Error.Printf("Error loading patients: %v", err)
	}

	out.Message = &results
}

func (a *Application) HandleGetClients(args []interface{}, out *Message) {
	if len(args) == 0 {
		Error.Printf("No clients requested")
		return
	}

	ids := []ClientID{}
	switch args[0].(type) {
	case []interface{}:
		for _, val := range args[0].([]interface{}) {
			switch val.(type) {
			case string:
				ids = append(ids, ClientID(val.(string)))
			default:
				Error.Printf("Bad ClientID: %v", val)
			}
		}
	default:
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	clients, err := a.Connection.GetClients(ids)
	if err != nil {
		Error.Printf("Error loading clients: %v", err)
		return
	}

	responseClients := []*ResponseClient{}
	for _, client := range clients {
		response, err := client.ToResponse(a.Connection)
		if err != nil {
			Error.Printf("Error converting client %s to response: %v", client.ID, err)
			continue
		}
		responseClients = append(responseClients, response)
	}

	out.Message = responseClients
}

func (a *Application) HandleGetPatients(args []interface{}, out *Message) {
	if len(args) == 0 {
		Error.Printf("No patients requested")
		return
	}

	ids := []PatientID{}
	switch args[0].(type) {
	case []interface{}:
		for _, val := range args[0].([]interface{}) {
			switch val.(type) {
			case string:
				ids = append(ids, PatientID(val.(string)))
			default:
				Error.Printf("Bad PatientID: %v", val)
			}
		}
	default:
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	patients, err := a.Connection.GetPatients(ids)
	if err != nil {
		Error.Printf("Error loading patients: %v", err)
		return
	}

	responsePatients := []*ResponsePatient{}
	for _, patient := range patients {
		response, err := patient.ToResponse(a.Connection)
		if err != nil {
			Error.Printf("Error converting patient %s to response: %v", patient.ID, err)
			continue
		}
		responsePatients = append(responsePatients, response)
	}

	out.Message = responsePatients
}

func (a *Application) HandleInsertPatient(args []interface{}, out *Message) {
	if len(args) < 2 {
		Error.Printf("Insufficient arguments to insert-patient")
		return
	}

	var rawPatient *ResponsePatient
	switch args[0].(type) {
	case map[string]interface{}:
		var err error
		rawPatient, err = DeserializeResponsePatient(args[0].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing patient: %v", err)
			return
		}
	}

	if rawPatient == nil {
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	var ownerIDs []ClientID
	switch args[1].(type) {
	case []interface{}:
		for _, rawID := range args[1].([]interface{}) {
			switch rawID.(type) {
			case string:
				ownerIDs = append(ownerIDs, ClientID(rawID.(string)))
			default:
				Error.Printf("Bad owner ID: %v", rawID)
				return
			}
		}
	default:
		Error.Printf("Bad argument: %v", args[1])
		return
	}

	patient, err := rawPatient.ToRealPatient(a.Connection)
	if err != nil {
		Error.Printf("Error actualizing patient: %v", err)
		return
	}

	err = a.Connection.InsertPatient(patient)
	if err != nil {
		Error.Printf("Error saving patient %s: %v", patient.ID, err)
		return
	}

	// Make sure the given owners all own this patient
	err = a.Connection.SetOwners(patient.ID, ownerIDs)
	if err != nil {
		Error.Printf("Error adding %v to owners of '%s': %v", ownerIDs, patient.ID, err)
	}

	out.Message = patient.ID
}

func (a *Application) HandleUpdatePatient(args []interface{}, out *Message) {
	if len(args) < 1 {
		Error.Printf("Insufficient arguments to update-patient")
		return
	}

	var rawPatient *ResponsePatient
	switch args[0].(type) {
	case map[string]interface{}:
		var err error
		rawPatient, err = DeserializeResponsePatient(args[0].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing patient: %v", err)
			return
		}
	}

	if rawPatient == nil {
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	err := a.Connection.UpdatePatient(rawPatient)
	if err != nil {
		Error.Printf("Error saving patient %s: %v", rawPatient.ID, err)
		return
	}

	out.Message = rawPatient.ID
}

func (a *Application) HandleInsertClient(args []interface{}, out *Message) {
	if len(args) < 2 {
		Error.Printf("Insufficient arguments to insert-client")
		return
	}

	var rawClient *ResponseClient
	switch args[0].(type) {
	case map[string]interface{}:
		var err error
		rawClient, err = DeserializeResponseClient(args[0].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing client: %v", err)
			return
		}
	}

	if rawClient == nil {
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	client, err := rawClient.ToRealClient(a.Connection)
	if err != nil {
		Error.Printf("Error actualizing client: %v", err)
		return
	}

	err = a.Connection.InsertClient(client)
	if err != nil {
		Error.Printf("Error saving client %s: %v", client.ID, err)
		return
	}

	out.Message = client.ID
}

func (a *Application) HandleUpdateClient(args []interface{}, out *Message) {
	if len(args) < 1 {
		Error.Printf("Insufficient arguments to update-client")
		return
	}

	var rawClient *ResponseClient
	switch args[0].(type) {
	case map[string]interface{}:
		var err error
		rawClient, err = DeserializeResponseClient(args[0].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing client: %v", err)
			return
		}
	}

	if rawClient == nil {
		Error.Printf("Bad argument: %v", args[0])
		return
	}

	err := a.Connection.UpdateClient(rawClient)
	if err != nil {
		Error.Printf("Error saving client %s: %v", rawClient.ID, err)
		return
	}

	out.Message = rawClient.ID
}

func (a *Application) HandleInsertVisit(args []interface{}, out *Message) {
	if len(args) < 2 {
		Error.Printf("Insufficient arguments to insert-visit")
		return
	}

	var patient PatientID
	switch args[0].(type) {
	case string:
		patient = PatientID(args[0].(string))
	}

	var rawVisit *ResponseVisit
	switch args[1].(type) {
	case map[string]interface{}:
		var err error
		rawVisit, err = DeserializeResponseVisit(args[1].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing visit: %v", err)
			return
		}
	}

	visit, err := rawVisit.ToRealVisit(a.Connection)
	if err != nil {
		Error.Printf("Error actualizing visit: %v", err)
		return
	}

	err = a.Connection.InsertVisit(patient, visit)
	if err != nil {
		Error.Printf("Error inserting visit %s in patient %s: %v", visit.ID, patient, err)
		return
	}

	out.Message = visit.ID
}

func (a *Application) HandleUpdateVisit(args []interface{}, out *Message) {
	if len(args) < 1 {
		Error.Printf("Insufficient arguments to update-visit")
		return
	}

	var rawVisit *ResponseVisit
	switch args[0].(type) {
	case map[string]interface{}:
		var err error
		rawVisit, err = DeserializeResponseVisit(args[0].(map[string]interface{}))
		if err != nil {
			Error.Printf("Error deserializing visit: %v", err)
			return
		}
	}

	err := a.Connection.UpdateVisit(rawVisit)
	if err != nil {
		Error.Printf("Error updating visit %s: %v", rawVisit.ID, err)
		return
	}

	out.Message = rawVisit.ID
}

// Handle an attempt to clear the current clinic's database. Only valid in
// testing mode.
func (a *Application) HandleClear(out *Message) {
	if !a.Testing {
		Error.Println("Attempt to clear a non-testing instance")
		return
	}

	Warning.Println("Clearing database")
	err := a.Connection.Clear()
	if err != nil {
		Error.Printf("Error clearing database: %v", err)
		return
	}

	out.Message = "ok"
}

func (a *Application) DispatchMethod(args []interface{}, out *Message) {
	var method string

	switch args[0].(type) {
	case string:
		method = args[0].(string)
	default:
		Error.Printf("method is not string: %v", method)
		return
	}

	args = args[1:]

	Info.Printf("%s()", method)
	switch method {
	case "search":
		a.HandleSearch(args, out)
	case "show-upcoming":
		a.HandleShowUpcoming(args, out)
	case "get-clients":
		a.HandleGetClients(args, out)
	case "get-patients":
		a.HandleGetPatients(args, out)
	case "insert-patient":
		a.HandleInsertPatient(args, out)
	case "update-patient":
		a.HandleUpdatePatient(args, out)
	case "insert-client":
		a.HandleInsertClient(args, out)
	case "update-client":
		a.HandleUpdateClient(args, out)
	case "insert-visit":
		a.HandleInsertVisit(args, out)
	case "update-visit":
		a.HandleUpdateVisit(args, out)
	case "clear":
		a.HandleClear(out)
	default:
		Error.Printf("Unknown method \"%s\"", method)
	}
}

func (a *Application) HandleMessage(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			Info.Printf("closing connection")
			return
		}

		if messageType != websocket.TextMessage {
			Error.Printf("got illegal message type: %v", messageType)
			continue
		}

		var req Message
		var res Message

		err = json.Unmarshal(data, &req)
		if err != nil {
			Error.Printf("got illegal JSON message: %s (%s)", data, err)
			continue
		}

		res.MessageID = req.MessageID
		res.Message = "error"

		switch req.Message.(type) {
		case []interface{}:
			args := req.Message.([]interface{})
			a.DispatchMethod(args, &res)
		default:
			Error.Printf("invalid message: %v", req.Message)
		}

		conn.WriteJSON(res)
	}
}

func (a *Application) Close() {
	a.Connection.Close()
}

// Secure the process by chrooting into an empty directory and dropping down
// to the given user.
func Lockdown(dropUser string) {
	user, err := user.Lookup(dropUser)
	if err != nil {
		Error.Printf("failed to look up user %s (%v)", dropUser, err)
		os.Exit(1)
	}

	gid, err := strconv.Atoi(user.Gid)
	if err != nil {
		Error.Printf("failed to understand gid %s (%v)", user.Uid, err)
		os.Exit(1)
	}

	uid, err := strconv.Atoi(user.Uid)
	if err != nil {
		Error.Printf("failed to understand uid %s (%v)", user.Uid, err)
		os.Exit(1)
	}

	chrootDir := "/var/empty"
	err = syscall.Chroot(chrootDir)
	if err != nil {
		Error.Printf("failed to chroot into %s (%v)", chrootDir, err)
		os.Exit(1)
	}

	if os.Chdir("/") != nil {
		panic("failed to cd /")
	}

	// Order is important here, since the whole set*id family has idiotic semantics
	// Speaking of idiotic, Linux doesn't support set*id in threaded
	// applications...
	if syscall.Setgroups(nil) != nil ||
		syscall.Setgid(gid) != nil ||
		syscall.Setuid(uid) != nil {
		Error.Printf("failed to drop permissions to %d,%d", uid, gid)
		os.Exit(1)
	}
}

func main() {
	// Setup logging
	Info = log.New(os.Stdout,
		"INFO: ",
		log.Ldate|log.Ltime|log.Lshortfile)

	Warning = log.New(os.Stderr,
		"WARNING: ",
		log.Ldate|log.Ltime|log.Lshortfile)

	Error = log.New(os.Stderr,
		"ERROR: ",
		log.Ldate|log.Ltime|log.Lshortfile)

	// Parse command-line arguments
	dropUserOption := flag.String("user", "daemon", "User as whom to drop permissions")
	hostOption := flag.String("host", "127.0.0.1:80", "Hostname to listen on")
	dbHostOption := flag.String("mongodb", "127.0.0.1:27017", "Hostname that MongoDB is running on")
	testingOption := flag.Bool("testing", false, "Allow dangerous testing operations")
	flag.Parse()

	if *testingOption {
		Warning.Println("========== TESTING MODE ENABLED ==========")
	}

	// Connect to database
	application, err := CreateApplication(*dbHostOption, *testingOption)
	if err != nil {
		Error.Printf("failed to connect to database: %v", err)
		os.Exit(1)
	}
	defer application.Close()

	http.HandleFunc("/", application.HandleMessage)
	listener, err := net.Listen("tcp", *hostOption)
	if err != nil {
		Error.Printf("failed to listen on %s (%v)", *hostOption, err)
		os.Exit(1)
	}

	// Once we have all of our sockets and files open, we can Shut Down Everything.
	Lockdown(*dropUserOption)

	// Start HTTP server
	Info.Println("listening...")
	err = http.Serve(listener, nil)
	if err != nil {
		Error.Printf("failed to start HTTP server: %v", err)
		os.Exit(1)
	}
}
