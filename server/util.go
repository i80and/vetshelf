package main

import (
	"errors"
	"fmt"
)

// Convert a list of unknown values into a list of strings.
func CastStringList(data []interface{}) ([]string, error) {
	var dirty []string
	var err error
	for _, field := range data {
		switch field.(type) {
		case string:
			dirty = append(dirty, field.(string))
		default:
			if err == nil {
				err = errors.New(fmt.Sprintf("Failed to convert value into string: %v", field))
			}
		}
	}

	return dirty, err
}

func ExtractStringList(data map[string]interface{}, key string) []string {
	// If we're provided a dirty list, include it
	switch data[key].(type) {
	case []interface{}:
		list, _ := CastStringList(data[key].([]interface{}))
		return list
	}

	return nil
}
