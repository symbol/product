from pathlib import Path

from flask import Flask, jsonify
from zenlog import log

def create_app():
    app = Flask(__name__)

    app.config.from_envvar('EXPLORER_REST_SETTINGS')

    db_path = Path(app.config.get('DATABASE_PATH'))

    log.info(f'loading database config from {db_path}')


    return app