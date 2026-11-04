from sqlalchemy import Numeric, String

ID = String(36)                               # UUID jako tekst (format bez zmian)
Money = Numeric(10, 2, asdecimal=False)       # NUMERIC(10,2) w bazie, float w Pythonie