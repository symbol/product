FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
	apt-get install -y \
	build-essential \
	libssl-dev \
	python3 \
	python3-pip \
	python3-venv \
	&& rm -rf /var/lib/apt/lists/*

# add ubuntu user
RUN id -u "ubuntu" || useradd --uid 1000 -ms /bin/bash ubuntu
USER ubuntu
WORKDIR /home/ubuntu

# create a virtual environment
ENV VIRTUAL_ENV=/home/ubuntu/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Create application directory
WORKDIR /app
COPY bridge/ /app/bridge
# need the latest lightapi(remove when lightapi is published to pypi)
COPY lightapi/python /app/lightapi

USER root
RUN pip install -e /app/lightapi

USER ubuntu
RUN pip install -r /app/bridge/requirements.txt \
	&& pip install gunicorn

EXPOSE 5000

# Number of workers for gunicorn
ENV NUMBER_OF_WORKERS=4
ENV PYTHONPATH=/app/bridge
ENV INTERVAL_TIME_IN_SECONDS=300

ENTRYPOINT ["/app/bridge/scripts/entrypoint.sh"]
CMD ["api"]
