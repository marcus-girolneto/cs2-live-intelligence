package normalize

import (
	"testing"

	"github.com/golang/geo/r3"
)

func TestAimEngagementWindowOncePerBurst(t *testing.T) {
	a := newAimTracker()
	for tick := 0; tick <= 300; tick++ {
		a.track("att").push(aimSample{tick: tick, yaw: float64(tick) / 10, pitch: 1, eye: r3.Vector{Z: 64}, ok: true})
		a.track("vic").push(aimSample{tick: tick, eye: r3.Vector{X: 100, Z: 64}, pos: r3.Vector{X: 100}, ok: true})
	}
	a.shot("att", 150, 64)
	a.shot("att", 160, 64)
	got := a.engagement("att", "vic", 162, 64)
	if got == nil || got.FirstShotTick != 150 || len(got.Dt) != 33 || got.Dt[0] != -32 || got.Dt[32] != 0 {
		t.Fatalf("window: %+v", got)
	}
	if got.Yaw[32] != 15 || got.TargetYaw != 0 || got.TargetPitch != 0 || got.BodyPitch <= 0 {
		t.Fatalf("angles: yaw=%v target=%v/%v body=%v", got.Yaw[32], got.TargetYaw, got.TargetPitch, got.BodyPitch)
	}
	// Same attacker, victim and burst: recorded once.
	if a.engagement("att", "vic", 170, 64) != nil {
		t.Fatal("second event of the engagement must not repeat the window")
	}
	// A shot after a gap starts a new burst.
	a.shot("att", 240, 64)
	if next := a.engagement("att", "vic", 241, 64); next == nil || next.FirstShotTick != 240 {
		t.Fatalf("new burst: %+v", next)
	}
	// No recent shot (e.g. a hit long after firing) or unknown players: nothing.
	if a.engagement("att", "vic", 400, 64) != nil || a.engagement("x", "vic", 241, 64) != nil {
		t.Fatal("unexpected window")
	}
}
