"""P0 bundle retention: 3 hourly plus the newest per day for 3 days (S6)."""


def test_bundle_retention(tmp_path):
    from lacuna_api.control.workers import _bundles_to_keep
    names = [f"lacuna-world-202610{d:02d}-{h:02d}00.bundle" for d, hs in
             ((20, (3, 22)), (21, (5, 23)), (22, (1, 12, 23)), (23, (0, 6, 9, 11))) for h in hs]
    names += ["lacuna-world-20261019-2300.bundle", "lacuna-world-20261019-0100.bundle"]
    assert len(names) == 13
    names += ["lacuna-world-20261023-1130.bundle", "lacuna-world-20261023-1131.bundle"]
    assert len(names) == 15
    for n in names:
        (tmp_path / n).write_bytes(b"x")
    keep = _bundles_to_keep([p.name for p in tmp_path.glob("*.bundle")])
    assert keep == {
        "lacuna-world-20261023-1100.bundle", "lacuna-world-20261023-1130.bundle", "lacuna-world-20261023-1131.bundle",  # 3 hourly
        "lacuna-world-20261022-2300.bundle", "lacuna-world-20261021-2300.bundle",                                       # daily, older days
    }
