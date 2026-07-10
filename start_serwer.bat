@echo off

:: Backend
powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/k cd /d C:\Users\malec\Desktop\Projekty\Caffenacci3\backend && uvicorn main:app --reload'"

:: Company
powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/k cd /d C:\Users\malec\Desktop\Projekty\Caffenacci3\caffenacci.company && npm run dev'"

:: Customer
powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/k cd /d C:\Users\malec\Desktop\Projekty\Caffenacci3\caffenacci.customer && npm run dev'"

exit