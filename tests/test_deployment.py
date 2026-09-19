import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'deployment', Path(__file__).resolve().parents[1] / '.github/scripts/deployment.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.run = {
            'id': 10, 'run_attempt': 1, 'workflow_id': 2,
            'head_sha': 'a' * 40, 'head_branch': 'main',
            'head_repository': {'full_name': 'edbfi/isfuglen'},
            'event': 'push', 'status': 'completed', 'conclusion': 'success',
            'created_at': '2026-09-19T00:00:00Z',
        }

    def select(self, runs, trigger=None):
        return deployment.select_run(runs, 2, 'edbfi/isfuglen', 'a' * 40, trigger)

    def test_current_successful_default_ci(self):
        self.assertEqual(self.select([self.run], self.run), self.run)

    def test_missing_or_pr_ci_is_not_publishable(self):
        for runs in [[], [{**self.run, 'event': 'pull_request'}]]:
            with self.subTest(runs=runs), self.assertRaises(ValueError):
                self.select(runs)

    def test_incomplete_or_unsuccessful_latest_attempt_blocks_old_success(self):
        for conclusion in [None, 'failure', 'cancelled', 'skipped', 'neutral']:
            newer = {**self.run, 'run_attempt': 2, 'conclusion': conclusion,
                     'run_started_at': '2026-09-19T00:01:00Z'}
            with self.subTest(conclusion=conclusion), self.assertRaises(ValueError):
                self.select([self.run, newer])
        with self.assertRaises(ValueError):
            self.select([{**self.run, 'status': 'in_progress'}])

    def test_wrong_workflow_branch_revision_or_repository_blocks(self):
        for key, value in [('workflow_id', 3), ('head_branch', 'other'),
                           ('head_sha', 'b' * 40),
                           ('head_repository', {'full_name': 'other/isfuglen'})]:
            changed = copy.deepcopy(self.run)
            changed[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.select([changed])

    def test_old_workflow_event_cannot_publish_newer_artifact(self):
        newer = {**self.run, 'id': 11, 'created_at': '2026-09-19T00:01:00Z'}
        with self.assertRaises(ValueError):
            self.select([self.run, newer], self.run)


if __name__ == '__main__':
    unittest.main()
