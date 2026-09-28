// A ~45ms "tock" — a low body tone plus a brief higher transient for
// onset definition, synthesized (not recorded) rather than a thin buzzy
// click. Deliberately tiny (8-bit, 8kHz mono) so the embedded base64
// stays short. Used as the native audio cue for each notch the
// MinutesDial passes while dragging. Embedded as a data URI so no
// separate asset file needs to ship in the repo; expo-audio's
// createAudioPlayer accepts a { uri } source directly.
export const DIAL_TICK_URI = 'data:audio/wav;base64,UklGRowBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWgBAACAoLnIzcnBubW2vMTLzsi7qJB5ZVZOS0tMTElEPjo5PEVTY3SEkZuhpamssba7vsC+uK+jl4p/dm5nYlxXUUxIRkdKUFdhanR8hIuSmJ6kqq6xsrGuqaKblI2FfnhxamRfWlZUU1VXW2BmbHJ4f4WLkpecoaSmpqWjoJyXko2Hgnx2cGtmY2BeXl9gYmZpbnJ3fYKHjJGVmJucnZ2bmpeUkIyHg355dXFtamhmZmZnaGptcHR4fICEiIyPkpSVlpaWlZOQjoqHg398eHVycG5sbGtsbW5wc3V4fH+ChYiLjY+QkZGRkI+Ni4mGg4F+e3h2dHJxcHBwcHJzdXd5fH6Bg4WIiYuMjY2NjYyLiYiGg4F/fXt5d3Z0dHNzdHR1d3h6fH6AgoSFh4iJioqKioqJiIaFg4GAfnx7eXh3dnZ2dnd3eHl7fH5/gYKDhYaHh4iIiIeHhoWEg4GAf318e3p5eXh4eHh5eno=';
