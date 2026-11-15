"""The docs gate (B23) refuses a README that names a file the tree does not have, and reads git's tree, not the sparse
disk (python3 -m pytest test_workshop_docs_gate.py)."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
import workshop  # noqa: E402


def _repo(tmp_path):
    def git(*a):
        subprocess.run(["git", "-C", str(tmp_path), *a], check=True, capture_output=True)
    git("init", "-q")
    (tmp_path / "tools" / "kit").mkdir(parents=True)
    (tmp_path / "tools" / "kit" / "run.py").write_text("print(1)\n")
    (tmp_path / "tools" / "kit" / "probes").mkdir()
    (tmp_path / "tools" / "kit" / "probes" / "a.js").write_text("1\n")
    git("add", ".")
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base")
    return tmp_path


def test_a_named_file_that_exists_passes_even_when_sparse(tmp_path):
    root = _repo(tmp_path)
    (root / "tools" / "kit" / "run.py").unlink()              # a sparse worktree: in git's tree, not on the disk
    (root / "tools" / "kit" / "README.md").write_text("`run.py` runs it; probes live in `probes/`; see `tools/kit/run.py`.")
    assert workshop.docs_gate(root, "tools/kit/README.md") == []


def test_an_invented_file_is_named(tmp_path):
    root = _repo(tmp_path)
    (root / "tools" / "kit" / "README.md").write_text("`run.py` and `report.py`; call `json.load` on `~/x.json`.")
    assert workshop.docs_gate(root, "tools/kit/README.md") == ["report.py"]


def test_a_path_from_a_folder_above_the_doc_passes(tmp_path):
    root = _repo(tmp_path)
    (root / "tools" / "kit" / "probes" / "README.md").write_text("see `kit/run.py` and `probes/a.js`; not `kit/gone.py`.")
    assert workshop.docs_gate(root, "tools/kit/probes/README.md") == ["kit/gone.py"]
