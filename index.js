class Score {
  constructor(title, author, key) {
    this.title = title;
    this.author = author;
    this.key = key;
    this.lines = [new Line()];
  }
  get length_line() {
    return this.lines.length;
  }
  get length_stave() {
    let count = 0;
    for (let line of this.lines) {
      count += line.length_stave;
    }
    return count;
  }
  get_stave_from_y_coord(y) {
    if (y >= this.length_stave) {
      return null;
    } else {
      let current_line = 0;
      let i = 0;
      while (i + this.lines[current_line].length_stave < y) {
        i += this.lines[current_line++].length_stave;
      }
      let remaining = y - i;
      return this.lines[current_line].staves[remaining];
    }
  }
  get_note_from_cursor(x, y) {
    let stave = this.get_stave_from_y_coord(y);
    if (x < stave.length_note) {
      let note = stave.notes[x];
      return note;
    } else {
      return null;
    }
  }
}

class Line {
  constructor() {
    this.staves = [new Stave()];
  }
  get length_stave() {
    return this.staves.length;
  }
}

class Stave {
  constructor() {
    this.notes = [];
  }
  get length_note() {
    return this.notes.length;
  }
  overwrite_note(x, number) {
    if (x < this.length_note) {
      this.notes[x].overwrite(number);
    } else {
      this.notes.push(new Note([number], 1));
    }
  }
  insert_note(x, number) {
    this.notes.splice(x, 0, new Note([number], 1));
  }
  uninsert(cursor_position) {
    if (cursor_position.x <= 0) {
      return;
    } else {
      this.notes.splice(cursor_position.x - 1, 1);
      cursor_position.x--;
    }
  }
  delete(x) {
    this.notes.splice(x, 1);
  }
}

class Note {
  constructor(letters, duration) {
    this.letters = letters;
    this.duration = duration;
  }
  overwrite(letter) {
    this.letters = [letter];
  }
  tower(letter) {
    this.letters.push(letter);
  }
}

class Editor {
  constructor(score, canvas, mode_slider, mode_display) {
    let self = this;

    this.score = score;
    this.canvas = canvas;
    this.canvas.width = 816;
    this.canvas.height = 1056;
    this.ctx = canvas.getContext("2d");
    this.mode_slider = mode_slider;
    this.mode_display = mode_display;

    this.cursor_position = { x: 0, y: 0 };
    this.mode = "insert"; //or "overwrite" or "read"

    window.addEventListener("keydown", function (e) {
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          self.arrow_keys_down(e.key);
          break;

        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          self.note_input(e.key);
          break;

        case "Backspace":
          self.note_delete();
          break;
      }

      self.draw();
    });

    this.mode_slider.addEventListener("input", function () {
      if (self.mode_slider.value == "0") {
        self.mode = "insert";
      } else if (self.mode_slider.value == "1") {
        self.mode = "overwrite";
      } else if (self.mode_slider.value == "2") {
        self.mode = "read";
      }
      self.mode_display.innerHTML = "Mode: " + self.mode;
    });
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = "100px serif";
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "black";
    this.ctx.fillText(this.score.title, this.canvas.width / 2, 120);

    let draw_y = 200;
    for (let line of this.score.lines) {
      for (let stave of line.staves) {
        let draw_x = 20;
        for (let note of stave.notes) {
          if (note == this.score.get_note_from_cursor(this.cursor_position.x, this.cursor_position.y)) {
            this.ctx.fillStyle = "pink";
            this.ctx.fillRect(draw_x, draw_y, 20, 30);
          }

          this.ctx.font = "30px serif";
          this.ctx.textAlign = "left";
          this.ctx.fillStyle = "black";
          this.ctx.fillText(note.letters[0].toString(), draw_x, draw_y + 30);

          draw_x += 20;
        }
      }
    }
  }
  arrow_keys_down(key) {
    if (key == "ArrowLeft") {
      this.cursor_position.x--;
      if (this.cursor_position.x < 0) {
        this.cursor_position.x = 0;
      }
    } else if (key == "ArrowRight") {
      this.cursor_position.x++;

      let num_notes = this.score.get_stave_from_y_coord(this.cursor_position.y).length_note;
      if (this.cursor_position.x > num_notes) {
        this.cursor_position.x = num_notes;
      }
    } else if (key == "ArrowUp") {
      this.cursor_position.y--;
      if (this.cursor_position.y < 0) {
        this.cursor_position.y = 0;
      }
    } else if (key == "ArrowDown") {
      this.cursor_position.y++;

      let num_staves = this.score.length_stave;
      if (this.cursor_position.y >= num_staves) {
        this.cursor_position.y = num_staves - 1;
      }
    }
  }
  note_input(number) {
    if (this.mode == "insert") {
      this.score.get_stave_from_y_coord(this.cursor_position.y).insert_note(this.cursor_position.x, parseInt(number));
    } else if (this.mode == "overwrite") {
      this.score.get_stave_from_y_coord(this.cursor_position.y).overwrite_note(this.cursor_position.x, parseInt(number));
    }
    //Do nothing if mode == "read"
  }
  note_delete() {
    if (this.mode == "overwrite") {
      this.score.get_stave_from_y_coord(this.cursor_position.y).delete(this.cursor_position.x);
    } else if (this.mode == "insert") {
      this.score.get_stave_from_y_coord(this.cursor_position.y).uninsert(this.cursor_position);
    }
  }
}

const editor = new Editor(
  new Score("Untitled", "Bach", "G"),
  document.getElementById("canvas"),
  document.getElementById("mode"),
  document.getElementById("mode-display"),
);
editor.draw();
