#!/bin/bash

# Run in a fresh postgres-python CI image, as ubuntu, without overriding PGDATA.
# Jenkins also exercises this initialization path in its existing setup-tests stage.
set -eu

# Preserve a primary failure; a cleanup failure must also fail an otherwise successful run.
cleanup() {
	local result="$1"
	local cluster_directory="$2"
	local status=0
	if [ ! -d "${cluster_directory}" ]; then
		exit "${result}"
	fi

	pg_ctl -D "${cluster_directory}" status >/dev/null || status=$?
	if [ "${status}" = 0 ]; then
		if ! pg_ctl -D "${cluster_directory}" stop -m immediate --wait; then
			echo "PostgreSQL shutdown failed; preserving ${cluster_directory}." >&2
			if [ "${result}" = 0 ]; then
				result=1
			fi
			exit "${result}"
		fi
	elif [ "${status}" != 3 ]; then
		echo "PostgreSQL status could not be determined (exit ${status}); preserving ${cluster_directory}." >&2
		if [ "${result}" = 0 ]; then
			result=1
		fi
		exit "${result}"
	fi

	if ! rm -rf -- "${cluster_directory}"; then
		echo "PostgreSQL cluster removal failed: ${cluster_directory}." >&2
		if [ "${result}" = 0 ]; then
			result=1
		fi
	fi
	exit "${result}"
}

# Keep the smoke entrypoint separate so cleanup can be exercised with isolated directories.
main() {
	script_directory="$(cd "$(dirname "$0")" && pwd)"
	if [ "$(id -un)" != ubuntu ] || [ "${PGDATA:-}" != /var/lib/postgresql/data ]; then
		echo 'This smoke test requires the CI image default user ubuntu and PGDATA=/var/lib/postgresql/data.' >&2
		exit 1
	fi

	printf 'user=%s inherited_PGDATA=%s\n' "$(id -un)" "${PGDATA}"
	# shellcheck source=scripts/ci/test_postgres_config.sh
	effective_pgdata=$(
		source "${script_directory}/test_postgres_config.sh"
		configure_test_postgres
		printf '%s' "${PGDATA}"
	)
	if [ "${effective_pgdata}" != /var/lib/postgresql/data/pgdata ] || [ -e "${effective_pgdata}" ]; then
		echo 'This smoke test requires a fresh, absent CI cluster directory.' >&2
		exit 1
	fi

	trap 'cleanup "$?" "${effective_pgdata}"' EXIT

	# Arrange: use the script defaults, retaining the image's original PGDATA above.
	unset EXPLORER_TEST_POSTGRES_SKIP_INIT
	printf 'effective_PGDATA=%s\n' "${effective_pgdata}"

	# Act: setup runs in a separate process, as it does in Jenkins.
	bash "${script_directory}/setup_test.sh"

	# shellcheck source=scripts/ci/test_postgres_config.sh
	source "${script_directory}/test_postgres_config.sh"
	configure_test_postgres

	# Assert: real cluster initialization and a connection to the selected user/database.
	test -f "${PGDATA}/PG_VERSION"
	actual=$(psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" \
		-U "${EXPLORER_TEST_POSTGRES_USER}" -d "${EXPLORER_TEST_POSTGRES_DATABASE}" -At \
		-c 'SELECT current_user, current_database()')
	expected="${EXPLORER_TEST_POSTGRES_USER}|${EXPLORER_TEST_POSTGRES_DATABASE}"
	test "${actual}" = "${expected}"
	printf 'verified=%s\n' "${actual}"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
	main
fi
