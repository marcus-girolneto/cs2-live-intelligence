package normalize

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// Frame bounds of the CS2 demo container. The library allocates every frame (and every snappy
// block's declared decoded length) before validating it, so a 27-byte input declaring a 2 GiB
// frame would allocate 2 GiB (found by FuzzNormalize). Real frames are at most a few MiB.
const (
	headerBytes          = 16 // "PBDEMS2\0" + two uint32 offsets
	maxFrameBytes        = 32 << 20
	maxDecodedFrameBytes = 64 << 20
	demIsCompressed      = 64
	demMaxCommand        = 32
)

var errFrame = errors.New("invalid CS2 demo frame")

// validateFrames walks the frame headers of the whole file and rejects unknown commands and
// frames (or snappy blocks) larger than the bounds above, before the library sees a byte. It reads only headers and snappy length prefixes: cheap even for 1 GiB.
func validateFrames(r io.ReadSeeker, size int64) error {
	if _, err := r.Seek(headerBytes, io.SeekStart); err != nil {
		return err
	}
	br := bufio.NewReaderSize(r, 64<<10)
	pos := int64(headerBytes)
	for pos < size {
		cmd, n1, err := readUvarint(br)
		if err != nil {
			return truncatedOr(err)
		}
		_, n2, err := readUvarint(br)
		if err != nil {
			return truncatedOr(err)
		}
		length, n3, err := readUvarint(br)
		if err != nil {
			return truncatedOr(err)
		}
		pos += int64(n1 + n2 + n3)
		if cmd&^demIsCompressed > demMaxCommand {
			return fmt.Errorf("%w: unknown command %d at byte %d", errFrame, cmd, pos)
		}
		if length > maxFrameBytes {
			return fmt.Errorf("%w: %d-byte frame at byte %d exceeds the frame limit", errFrame, length, pos)
		}
		if int64(length) > size-pos {
			return fmt.Errorf("%w: truncated frame at byte %d", errFrame, pos)
		}
		if cmd&demIsCompressed != 0 && length > 0 {
			decoded, n, err := readUvarint(br)
			// Snappy expands at most ~22x (a 3-byte copy emits 64 bytes).
			if err != nil || decoded > maxDecodedFrameBytes || uint64(n) > length || decoded > 24*length+64 {
				return fmt.Errorf("%w: compressed frame at byte %d declares %d decoded bytes", errFrame, pos, decoded)
			}
			if _, err = br.Discard(int(length) - n); err != nil {
				return truncatedOr(err)
			}
		} else if _, err = br.Discard(int(length)); err != nil {
			return truncatedOr(err)
		}
		pos += int64(length)
	}
	return nil
}

// truncatedOr: a truncated or malformed frame header (EOF inside it, or a varint over 32 bits)
// is invalid. The library would fail such a demo anyway (unexpected end of demo), but only
// after allocating whatever size the partial varint declared.
func truncatedOr(err error) error {
	return fmt.Errorf("%w: malformed or truncated frame header (%v)", errFrame, err)
}

func readUvarint(br *bufio.Reader) (uint64, int, error) {
	var n int
	v, err := binary.ReadUvarint(byteCounter{br, &n})
	if err == nil && v > 1<<32 {
		err = errFrame
	}
	return v, n, err
}

type byteCounter struct {
	r *bufio.Reader
	n *int
}

func (c byteCounter) ReadByte() (byte, error) {
	b, err := c.r.ReadByte()
	if err == nil {
		*c.n++
	}
	return b, err
}
