"""
GENRI LABS — PASSENGER ENTRY POINT (cPanel)

cPanel's "Setup Python App" looks for this exact file and the
`application` variable. Do not rename either. All it does is
expose the Flask app to Passenger.
"""
from app import app as application  # noqa: F401
