const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const app = express();
const port = 3000;
const mysql = require('mysql');
const Excel = require('exceljs');
const path = require('path');
const fs = require('fs');
app.use(bodyParser.json());// used to parse the incoming request data (usually in JSON format) and make it available on req.body for further handling in post req below

//all db connections promisified to catch runtime exceptions
//all necessary keys & values for mysql configuration goes here
const connectionConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Msk9848',
    database: 'student'
};

// Configure CORS to allow requests from a specific origin like our hosted front end website addr.
const corsOptions = {
    origin: 'http://localhost:5173',
};
app.use(cors(corsOptions));


//this section is for gmail admin gmail data using googlecloud playground refresh token
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
        clientId: process.env.OAUTH_CLIENTID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN
    }
});


//promisifying the database connections to handle runtime errors 
const connectToDatabase = () => {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connectionConfig);
        connection.connect(err => {
            if (err) {
                reject(err);
            } else {
                console.log('Connected to MySQL as id ' + connection.threadId);
                resolve(connection);
            }
        });
    });
};


//as connection.query doesn't return a promise we promisified it for handling run time errors
const executeQuery = (connection, sql) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
};

//dummy test
// app.get('/', (req, res) => {
//     res.send('Hello, this is your server.');
// });


//collects the posted data from the front-end
app.post('/submit', async (req, res) => {
    const formData = req.body;
    console.log('Received data:', formData);

    const dataforStudent = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #ffffff;
                        border-radius: 5px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    h1 {
                        color: #333;
                    }
                    p {
                        color: #666;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 10px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Successful Registration</h1>
                    <p>Dear ${formData.name},</p>
                    <p>This email is to confirm that your registration at JNTUHCEJ has been successfully completed. Below are your registration details:</p>

                    <table>
                        <tr>
                            <th>Roll Number</th>
                            <td>${formData.rollNo.toUpperCase()}</td>
                        </tr>
                        <tr>
                            <th>Name</th>
                            <td>${formData.name.toUpperCase()}</td>
                        </tr>
                        <tr>
                            <th>Email</th>
                            <td>${formData.email}</td>
                        </tr>
                        <tr>
                            <th>Branch</th>
                            <td>${formData.branch}</td>
                        </tr>
                    </table>

                    <p>If you have any questions or need assistance, please feel free to reach out to our support team at our <a href="https://www.jntuhcej.ac.in/">Official WebSite</a>.</p>
                </div>
            </body>
        </html>
    `;

    let mailOptions = {
        from: 'jntuhucej3@gmail.com',
        to: formData.email,
        subject: 'Regarding Form Submission',
        html: dataforStudent,
    };

    try {
        const connection = await connectToDatabase();

        await executeQuery(connection, `
            INSERT INTO student_data (rollNo, name, email, branch)
            VALUES ('${formData.rollNo.toUpperCase()}', '${formData.name.toUpperCase()}', '${formData.email}', '${formData.branch.toUpperCase()}')
        `);

        connection.end();

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.response);
        res.status(200).json({ message: 'Data received and email sent successfully' });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: 'An error occurred.' });
    }
});

//to listen to post requests:
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

setTimeout(async () => {
    try {
        const connection = await connectToDatabase();

        const sql = `SELECT rollNo, name, email, branch
            FROM student_data
            ORDER BY branch, rollNo;
        `;

        const results = await executeQuery(connection, sql);

        const formattedData = `
            <html>
                <head>
                    <style>
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        th, td {
                            border: 1px solid black;
                            padding: 10px;
                            text-align: left;
                        }
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <th>Student Roll No</th>
                            <th>Student Name</th>
                            <th>Student Email</th>
                            <th>Student Branch</th>
                        </tr>
                        ${results.map(result => `
                            <tr>
                                <td>${result.rollNo}</td>
                                <td>${result.name}</td>
                                <td>${result.email}</td>
                                <td>${result.branch}</td>
                            </tr>
                        `).join('')}
                    </table>
                </body>
            </html>
        `;

        //update as required below are admin emails
        const emailsToSend = ['msaikiran9848250763@gmail.com', 'optionalname56@gmail.com', 's2612369@gmail.com'];

        mailOptions = {
            from: 'jntuhucej3@gmail.com',
            to: emailsToSend.join(', '),
            subject: 'Student form data:',
            html: formattedData,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email: ' + error.stack);
            } else {
                console.log('Email sent successfully:', info.response);
            }
            connection.end();
        });
    } catch (error) {
        console.error('Error executing query: ' + error.stack);
    }
}, 1000);




//database details:
//database name:student
//table name: student_details
//student_details schema:
// CREATE TABLE student_data (
//     rollNo VARCHAR(20) PRIMARY KEY,
//     name VARCHAR(255),
//     email VARCHAR(255),
//     branch VARCHAR(10)
// );