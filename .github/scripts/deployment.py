"""Select only the newest complete CI artifact for the current default revision."""

import json
import os
from pathlib import Path
import re
import subprocess


def require(condition, message):
    if not condition:
        raise ValueError(message)


def select_run(runs, workflow_id, repository, revision, trigger=None):
    candidates = [run for run in runs if run['event'] in {'push', 'workflow_dispatch'}]
    require(candidates, 'Default-branch CI is missing')
    run = max(candidates, key=lambda item: (
        item.get('run_started_at') or item['created_at'], item['id'], item['run_attempt']))
    require(run['workflow_id'] == workflow_id and run['head_sha'] == revision
            and run['head_branch'] == 'main'
            and run['head_repository']['full_name'] == repository,
            'CI workflow, repository or revision differs')
    require(run['status'] == 'completed' and run['conclusion'] == 'success',
            'Newest default-branch CI has not succeeded')
    if trigger is not None:
        require(trigger['id'] == run['id'] and trigger['run_attempt'] == run['run_attempt']
                and trigger['head_sha'] == revision,
                'Deployment was triggered by stale CI')
    return run


def main():
    repository = os.environ['GITHUB_REPOSITORY']
    require(repository == 'edbfi/isfuglen', 'Unexpected deployment repository')

    def read(path, pages=False):
        command = ['gh', 'api', f'repos/{repository}{path}']
        if pages:
            command.extend(['--paginate', '--slurp'])
        return json.loads(subprocess.check_output(command, text=True))

    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    kind = os.environ['GITHUB_EVENT_NAME']
    require(kind in {'workflow_run', 'workflow_dispatch'}, 'Unexpected deployment event')
    trigger = event.get('workflow_run') if kind == 'workflow_run' else None
    revision = trigger['head_sha'] if trigger else os.environ['GITHUB_SHA']
    require(re.fullmatch(r'[0-9a-f]{40}', revision), 'Invalid deployment revision')
    require(os.environ['GITHUB_REF_NAME'] == 'main'
            and os.environ['GITHUB_SHA'] == revision, 'Deployment is not on current main')
    require(read('')['default_branch'] == 'main', 'Default branch changed')
    require(read('/git/ref/heads/main')['object']['sha'] == revision,
            'Default branch advanced before deployment')
    workflow = read('/actions/workflows/ci.yml')
    require(workflow['path'] == '.github/workflows/ci.yml' and workflow['state'] == 'active',
            'Unexpected or inactive CI workflow')
    pages = read(f'/actions/workflows/{workflow["id"]}/runs?head_sha={revision}&branch=main&per_page=100', True)
    run = select_run([run for page in pages for run in page['workflow_runs']],
                     workflow['id'], repository, revision, trigger)
    require(not os.environ.get('EXPECTED_CI_RUN_ID') or (
        os.environ['EXPECTED_CI_RUN_ID'] == str(run['id'])
        and os.environ['EXPECTED_CI_ATTEMPT'] == str(run['run_attempt'])),
        'CI changed after artifact selection')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'run-id={run["id"]}\nrun-attempt={run["run_attempt"]}\n')


if __name__ == '__main__':
    try:
        main()
    except (KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError):
        raise SystemExit('Deployment blocked: current successful default-branch CI is not proven') from None
