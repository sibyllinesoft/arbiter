// Simple test CUE file for watcher testing

package test

// A simple schema
User: {
	name: string
	age:  int & >=0 & <=150
	email: string & =~"^[^@]+@[^@]+$"
}

// Instance validation
user1: User & {
	name:  "John Doe"
	age:   30
	email: "john@example.com"
}

// Test constraint
validAge: int & >=18 & <=65