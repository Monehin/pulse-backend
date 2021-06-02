# DevPulse application implementation in Strapi

This is an implementation of DevPulse using [Strapi](https://strapi.io) which is a headless CMS that allows users to create and manage API's easily. 

## Trello board

https://trello.com/b/JknBplk6/devpulse

## Installation 

To install and run the application on your machine

1. Clone the application
`git clone https://github.com/atlp-rwanda/pulse-backend.git`

2. Copy the .env.example to .env and add your env variables

3. `npx install`

4. Head over to `http://localhost:1337` and open the admin panel

## Usage

Once you get to the admin panel, register your account and remember to save your account details. You cannot register or forgot password. If you forget your password you have to register all over again by reseting your db.

Next thing is to create collection types.

## Collection types 

Collection types are a type of data store schema that describe the data that you want to access and store. Currently we have Companies, Invites, Programs, Rating_attribute, Ratings, Skills, user_cohort_program and users

### Applications

This is for application to the apprenticeship program.

### Cohort program scheduels

Timelines for the different programs

### Cohorts

Cohorts or intakes

### Companies

The companies that apprentices will be working with for the apprenticeship program

### Invites

This is to allow users to register to the system

### programs

The different programs e.g Bootcamp, Project Work and Apprenticeship

### Ratings attributes

This describes the attributes that we will be ratings the trainees on e.g professionalism, quality, quantity. This will be a numeric input with a min max. We will use the json format to define what each rating signifies. 

e.g Quality or Quantity

```
{
  "0": "Unsatisfactory",
  "1": "Meets expectations",
  "2": "Exceeds expectations"
}
```

### Ratings
.
This will be the actual ratings for a particular attribute attached to an assessor/manager a trainee and a user_cohort_program

### Skills

These are skills that a trainee has e.g Javascript, HTML/CSS, Devops e.t.c

### User Cohort Program

This creates a relationship between a trainee, the manager, the cohort program, the company and the rating. 

Question: Why do we need to attach the ratings here?

### Users

These will be the users of our application. Both trainees and managers.
