class Note {
  constructor(number, dot_level) {
    this.number = number; // zero = rest
    this.dot_level = dot_level;
    this.parent = null;
  }
  get left() {
    return this.parent.left_group.notes[0];
  }
  get right() {
    return this.parent.right_group.notes[0];
  }
  get up() {
    return this.parent.up_note(this);
  }
  get down() {
    return this.parent.down_note(this);
  }
  get current_group() {
    return this.parent;
  }
  get current_voice() {
    return this.parent.parent;
  }
  dot_up() {
    this.dot_level++;
  }
  dot_down() {
    this.dot_level--;
  }
  ease_json() {
    return {
      number: this.number,
      dot_level: this.dot_level,
    };
  }
}
Note.from_json = function (json) {
  const note = new Note(json.number, json.dot_level);
  return note;
};

class Group {
  constructor() {
    this.notes = []; //0th = bottom
    this.duration = 1;
    this.parent = null;
  }
  get bottom_note() {
    return this.notes[0];
  }
  get top_note() {
    return this.notes[this.notes.length - 1];
  }
  get current_voice() {
    return this.parent;
  }
  get empty() {
    return this.notes.length === 0 || (this.notes.length === 1 && this.notes[0].number === 0);
  }
  note_index(current_note) {
    for (let i = 0; i < this.notes.length; i++) {
      if (this.notes[i] === current_note) {
        return i;
      }
    }
    return -1;
  }
  add_notes(index, ...notes) {
    if (notes.length >= 1 && this.bottom_note != null && this.bottom_note.number === 0) {
      this.notes = [];
    }
    this.notes.splice(index, 0, ...notes);
    for (let note of notes) {
      note.parent = this;
    }
  }
  get left_group() {
    return this.parent.left_group(this);
  }
  get right_group() {
    return this.parent.right_group(this);
  }
  up_note(current_note) {
    if (current_note === this.top_note) {
      return this.parent.up_group(this).bottom_note;
    } else {
      let index = this.note_index(current_note);
      return this.notes[index + 1];
    }
  }
  down_note(current_note) {
    if (current_note === this.bottom_note) {
      return this.parent.down_group(this).top_note;
    } else {
      let index = this.note_index(current_note);
      return this.notes[index - 1];
    }
  }
  delete_note(current_note) {
    let index = this.note_index(current_note);
    this.notes.splice(index, 1);
    if (this.bottom_note == null) {
      this.add_notes(0, new Note(0, 0));
    }
  }
  ease_json() {
    return {
      notes: this.notes.map(function (e) {
        return e.ease_json();
      }),
      duration: this.duration,
    };
  }
}
Group.from_json = function (json) {
  const group = new Group();
  group.duration = json.duration;
  group.add_notes(
    0,
    ...json.notes.map(function (e) {
      return Note.from_json(e);
    }),
  );
  return group;
};
class Rest_Group extends Group {
  constructor(voice) {
    super();

    this.add_notes(0, new Note(0, 0));
    this.duration = voice.total_duration;
  }
}

class Voice {
  constructor() {
    this.groups = [];
    this.parent = null;
  }
  get first_group() {
    return this.groups[0];
  }
  get last_group() {
    return this.groups[this.groups.length - 1];
  }
  get total_duration() {
    return this.parent.total_duration;
  }
  insert_default(current_note, number, duration) {
    let current_group = current_note.current_group;
    let index = this.group_index(current_group);
    if (current_group === this.last_group) {
      let group = new Group();
      group.add_notes(0, new Note(number, 0));
      group.duration = duration;

      this.add_group(index, group);
    } else {
      let group = this.groups[index];
      let note_index = group.note_index(current_note);
      group.add_notes(note_index + 1, new Note(number, 0));
    }
  }
  insert_after(current_note, number, duration) {
    let index = this.group_index(current_note.current_group);

    let group = new Group();
    group.add_notes(0, new Note(number, 0));
    group.duration = duration;

    this.add_group(index + 1, group);
  }
  overwrite(current_note, number) {
    let group = current_note.current_group;
    let index = group.note_index(current_note);
    let note = new Note(number, 0);
    group.notes = [];
    group.add_notes(index, note);
    return note;
  }
  delete_note(current_note, mode) {
    let group = current_note.current_group;
    if (group.empty) {
      let successor;
      if (mode === "insert" || mode === "overwrite") {
        successor = group.right_group;
      } else {
        successor = group.left_group;
      }
      this.delete_group(group);
      return successor.notes[0];
    } else {
      let index = group.note_index(current_note);
      group.delete_note(current_note);
      return group.notes[Math.max(0, index - 1)];
    }
  }
  delete_group(current_group) {
    let index = this.group_index(current_group);
    this.groups.splice(index, 1);
  }
  group_precumulative_duration(current_group) {
    let index = this.group_index(current_group);
    let cumulative_duration = 0;
    for (let i = 0; i < index; i++) {
      cumulative_duration += this.groups[i].duration;
    }
    return cumulative_duration;
  }
  group_at_precumulative_duration(total_duration) {
    let current_duration = 0;
    let i = 0;
    while (current_duration < total_duration && i + 1 < this.groups.length) {
      current_duration += this.groups[i++].duration;
    }
    return this.groups[i];
  }
  notes_until_next_quarter(current_group) {
    let current_duration = this.group_precumulative_duration(current_group) + current_group.duration;
    let next_quarter = Math.ceil(current_duration);
    let index = this.group_index(current_group) + 1;
    let note_count = 1;
    while (current_duration < next_quarter && index < this.groups.length) {
      current_duration += this.groups[index++].duration;
      note_count++;
    }
    if (current_duration === next_quarter) {
      return note_count;
    } else {
      return 9999999;
    }
  }
  notes_in_same_duration_run(current_group) {
    let duration = current_group.duration;
    let count = 0;
    let index = this.group_index(current_group);
    while (this.groups[index++].duration === duration && index < this.groups.length) {
      count++;
    }
    return count;
  }
  add_group(index, ...groups) {
    this.groups.splice(index, 0, ...groups);
    for (let group of groups) {
      group.parent = this;
    }
  }
  group_index(current_group) {
    for (let i = 0; i < this.groups.length; i++) {
      if (this.groups[i] === current_group) {
        return i;
      }
    }
  }
  left_group(current_group) {
    if (current_group === this.first_group) {
      return this.parent.left_voice(this).last_group;
    } else {
      let index = this.group_index(current_group);
      return this.groups[index - 1];
    }
  }
  right_group(current_group) {
    if (current_group === this.last_group) {
      return this.parent.right_voice(this).first_group;
    } else {
      let index = this.group_index(current_group);
      return this.groups[index + 1];
    }
  }
  up_group(current_group) {
    let precumulative_duration = this.group_precumulative_duration(current_group);
    return this.parent.up_voice(this).group_at_precumulative_duration(precumulative_duration);
  }
  down_group(current_group) {
    let precumulative_duration = this.group_precumulative_duration(current_group);
    return this.parent.down_voice(this).group_at_precumulative_duration(precumulative_duration);
  }
  ease_json() {
    return {
      groups: this.groups.map(function (e) {
        return e.ease_json();
      }),
    };
  }
}
Voice.from_json = function (json) {
  const voice = new Voice();
  voice.add_group(
    0,
    ...json.groups.map(function (e) {
      return Group.from_json(e);
    }),
  );
  return voice;
};

class Stave {
  constructor() {
    this.voices = []; //0th = bottom
    this.parent = null;
    this.total_duration = 4;
  }
  get first_voice() {
    return this.voices[0];
  }
  get last_voice() {
    return this.voices[this.voices.length - 1];
  }
  add_voice(...voices) {
    this.voices.push(...voices);
    for (let voice of voices) {
      voice.parent = this;
    }
  }
  voice_index(current_voice) {
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i] === current_voice) {
        return i;
      }
    }
  }
  get_voice_at_index(index) {
    if (index >= this.voices.length) {
      return this.last_voice;
    } else {
      return this.voices[index];
    }
  }
  left_voice(current_voice) {
    let index = this.voice_index(current_voice);
    return this.parent.left_stave(this).get_voice_at_index(index);
  }
  right_voice(current_voice) {
    let index = this.voice_index(current_voice);
    return this.parent.right_stave(this).get_voice_at_index(index);
  }
  up_voice(current_voice) {
    if (current_voice === this.last_voice) {
      return this.parent.up_stave(this).first_voice;
    } else {
      let index = this.voice_index(current_voice);
      return this.voices[index + 1];
    }
  }
  down_voice(current_voice) {
    if (current_voice === this.first_voice) {
      return this.parent.down_stave(this).last_voice;
    } else {
      let index = this.voice_index(current_voice);
      return this.voices[index - 1];
    }
  }
  ease_json() {
    return {
      voices: this.voices.map(function (e) {
        return e.ease_json();
      }),
      total_duration: this.total_duration,
    };
  }
}
Stave.from_json = function (json) {
  const stave = new Stave();
  stave.total_duration = json.total_duration;
  stave.add_voice(
    ...json.voices.map(function (e) {
      return Voice.from_json(e);
    }),
  );
  return stave;
};

class Score {
  constructor(instruments, default_time_signature) {
    this.title = "Untitled";
    this.author = "Author";
    this.staves = [];
    this.instruments = instruments;
    this.default_time_signature = default_time_signature;
  }
  get default_measure_duration() {
    return Math.round((4 / this.default_time_signature[1]) * this.default_time_signature[0]);
  }
  get num_instruments() {
    return this.instruments.length;
  }
  get instrument_independent_length() {
    return Math.round(this.staves.length / this.num_instruments);
  }
  add_stave(...staves) {
    this.staves.push(...staves);
    for (let stave of staves) {
      stave.parent = this;
      stave.total_duration = this.default_measure_duration;
    }
  }
  stave_index(current_stave) {
    for (let i = 0; i < this.staves.length; i++) {
      if (this.staves[i] === current_stave) {
        return i;
      }
    }
  }
  left_stave(current_stave) {
    let index = this.stave_index(current_stave);
    let instrument_independent_index = Math.floor(index / this.num_instruments);
    let instrument = index % this.num_instruments;
    if (instrument_independent_index === 0) {
      return this.staves[this.staves.length - this.num_instruments + instrument];
    } else {
      return this.staves[index - this.num_instruments];
    }
  }
  right_stave(current_stave) {
    let index = this.stave_index(current_stave);
    let instrument_independent_index = Math.floor(index / this.num_instruments);
    let instrument = index % this.num_instruments;
    if (instrument_independent_index === this.instrument_independent_length - 1) {
      return this.staves[instrument];
    } else {
      return this.staves[index + this.num_instruments];
    }
  }
  up_stave(current_stave) {
    let index = this.stave_index(current_stave);
    if (index > 0) {
      return this.staves[index - 1];
    } else {
      return this.staves[0];
    }
  }
  down_stave(current_stave) {
    let index = this.stave_index(current_stave);
    if (index < this.staves.length - 1) {
      return this.staves[index + 1];
    } else {
      return this.staves[this.staves.length - 1];
    }
  }
  ease_json() {
    return {
      title: this.title,
      author: this.author,
      staves: this.staves.map(function (e) {
        return e.ease_json();
      }),
      instruments: this.instruments,
      default_time_signature: this.default_time_signature,
    };
  }
  get first_note() {
    return this.staves[0].first_voice.first_group.bottom_note;
  }
}
Score.from_json = function (json) {
  const score = new Score(json.instruments, json.default_time_signature);
  score.title = json.title;
  score.author = json.author;
  score.add_stave(
    ...json.staves.map(function (e) {
      return Stave.from_json(e);
    }),
  );
  return score;
};

class Editor {
  constructor() {
    const score = new Score(["guzheng left", "guzheng right"], [4, 4]);

    const left_stave = new Stave();
    const right_stave = new Stave();
    score.add_stave(left_stave, right_stave);

    const voice1 = new Voice();
    const voice2 = new Voice();
    left_stave.add_voice(voice1);
    right_stave.add_voice(voice2);

    const rest_group1 = new Rest_Group(voice1);
    const rest_group2 = new Rest_Group(voice2);
    voice1.add_group(0, rest_group1);
    voice2.add_group(0, rest_group2);

    this.score = score;

    this.cursor = rest_group1.notes[0];
    this.mode = "after";
    this.default_duration = 1;

    this.input_mode = true;

    const self = this;
    window.addEventListener("keydown", function (e) {
      if (!self.input_mode) {
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          self.cursor_left();
          break;
        case "ArrowRight":
          e.preventDefault();
          self.cursor_right();
          break;
        case "ArrowUp":
          e.preventDefault();
          self.cursor_up();
          break;
        case "ArrowDown":
          e.preventDefault();
          self.cursor_down();
          break;

        case "o":
          self.mode = "overwrite";
          self.display_mode();
          break;

        case "a":
          self.mode = "after";
          self.display_mode();
          break;

        case "i":
          self.mode = "insert";
          self.display_mode();
          break;

        case "r":
          self.mode = "read";
          self.display_mode();
          break;

        case ".":
          self.duration_up();
          self.display_duration();
          break;

        case ",":
          self.duration_down();
          self.display_duration();
          break;

        case "-":
          self.note_down();
          break;

        case "=":
          self.note_up();
          break;

        case "p":
          self.handle_print();
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
          self.note_input(parseInt(e.key));
          break;

        case "Backspace":
          self.note_delete();
          break;
      }

      self.draw();
    });

    document.getElementById("mode").addEventListener("input", function () {
      self.mode = Editor.mode_map[this.value];
      self.display_mode();
    });

    document.getElementById("duration").addEventListener("input", function () {
      self.default_duration = Editor.duration_map[this.value];
      self.display_duration();
    });

    document.getElementById("print-button").addEventListener("click", this.handle_print);

    document.getElementById("title").addEventListener("focusin", function () {
      self.input_mode = false;
    });
    document.getElementById("title").addEventListener("focusout", function () {
      self.input_mode = true;
    });
    document.getElementById("title").addEventListener("input", function () {
      self.score.title = this.value;
      self.draw();
    });
    document.getElementById("author").addEventListener("focusin", function () {
      self.input_mode = false;
    });
    document.getElementById("author").addEventListener("focusout", function () {
      self.input_mode = true;
    });
    document.getElementById("author").addEventListener("input", function () {
      self.score.author = this.value;
      self.draw();
    });

    document.getElementById("save-button").addEventListener("click", function () {
      self.save_score(self.score);
    });

    document.getElementById("json-button").addEventListener("click", function () {
      self.export_json();
    });
    document.getElementById("json-input").addEventListener("change", function (e) {
      const file = e.target.files[0];

      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          self.load_json(e.target.result);
        };
        reader.readAsText(file);
      }
    });

    this.draw();
    this.display_duration();
    this.display_mode();
    this.load_scores();
    this.display_title_and_author();
  }
  display_title_and_author() {
    document.getElementById("title").value = this.score.title;
    document.getElementById("author").value = this.score.author;
  }
  load_json(json) {
    this.score = Score.from_json(JSON.parse(json));
    this.cursor = this.score.first_note;
    this.draw();
    this.display_title_and_author();
  }
  save_score(score) {
    const scores = JSON.parse(localStorage.getItem("scores"));
    let index = scores.findIndex(function (e) {
      return e.title === score.title;
    });
    if (index < 0) {
      scores.push(this.score.ease_json());
    } else {
      scores[index] = this.score.ease_json();
    }
    localStorage.setItem("scores", JSON.stringify(scores));
    this.load_scores();
  }
  load_score(title) {
    const scores = JSON.parse(localStorage.getItem("scores"));
    this.score = Score.from_json(
      scores.find(function (e) {
        return e.title === title;
      }),
    );
    this.cursor = this.score.first_note;
    this.draw();
    this.display_title_and_author();
  }
  load_scores() {
    const self = this;

    document.getElementById("saved-scores").innerHTML = "";
    if (!localStorage.getItem("scores")) {
      localStorage.setItem("scores", JSON.stringify([]));
    }
    let scores = JSON.parse(localStorage.getItem("scores"));
    for (let score of scores) {
      const button = document.createElement("button");
      button.innerHTML = score.title;
      document.getElementById("saved-scores").appendChild(button);

      button.addEventListener("click", function () {
        self.load_score(score.title);
      });

      const delete_button = document.createElement("button");
      delete_button.innerHTML = "X";
      document.getElementById("saved-scores").appendChild(delete_button);

      delete_button.addEventListener("click", function () {
        self.delete_score(score.title);
      });

      const br = document.createElement("br");
      document.getElementById("saved-scores").appendChild(br);
    }
  }
  delete_score(title) {
    const scores = JSON.parse(localStorage.getItem("scores"));
    scores.splice(
      scores.findIndex(function (e) {
        return e.title === title;
      }),
      1,
    );
    localStorage.setItem("scores", JSON.stringify(scores));
    this.load_scores();
  }
  export_json() {
    const json = JSON.stringify(this.score.ease_json(), null, 2);
    const file = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = `${this.score.title}-${this.score.author}-score.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  handle_print() {
    this.draw(true);
    const canvas = document.getElementById("canvas");
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${this.score.title}-${this.score.author}-score.png`;
    a.click();
    a.remove();
  }
  display_mode() {
    document.getElementById("mode-display").innerHTML = "Mode: " + this.mode;
    document.getElementById("mode").value = Editor.mode_map.indexOf(this.mode);
  }
  display_duration() {
    document.getElementById("duration-display").innerHTML = "Duration: " + this.default_duration.toString();
    document.getElementById("duration").value = Editor.duration_map.indexOf(this.default_duration);
  }
  note_up() {
    this.cursor.dot_up();
  }
  note_down() {
    this.cursor.dot_down();
  }
  duration_up() {
    let index = Editor.duration_map.indexOf(this.default_duration);
    if (index < Editor.duration_map.length - 1) {
      this.default_duration = Editor.duration_map[index + 1];
    }
  }
  duration_down() {
    let index = Editor.duration_map.indexOf(this.default_duration);
    if (index > 0) {
      this.default_duration = Editor.duration_map[index - 1];
    }
  }
  dot_display() {
    document.getElementById("dot-display").innerHTML = "Dot level: " + this.cursor.dot_level.toString();
  }
  note_display() {
    document.getElementById("note-display").innerHTML = "Note: " + this.cursor.number.toString();
  }
  cursor_left() {
    this.cursor = this.cursor.left;
  }
  cursor_right() {
    this.cursor = this.cursor.right;
  }
  cursor_up() {
    this.cursor = this.cursor.up;
  }
  cursor_down() {
    this.cursor = this.cursor.down;
  }
  note_input(number) {
    if (this.mode === "insert") {
      this.cursor.current_voice.insert_default(this.cursor, number, this.default_duration);
    } else if (this.mode === "after") {
      this.cursor.current_voice.insert_after(this.cursor, number, this.default_duration);
      this.cursor = this.cursor.right;
    } else if (this.mode === "overwrite") {
      this.cursor = this.cursor.current_voice.overwrite(this.cursor, number);
    }
  }
  note_delete() {
    if (this.mode !== "read") {
      let to_be_deleted = this.cursor;
      this.cursor = this.cursor.current_voice.delete_note(to_be_deleted);
    }
  }
  draw(is_print = false) {
    const canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "50px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(this.score.title, canvas.width / 2, 120);

    ctx.font = "25px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(this.score.author, canvas.width / 2, 170);

    const NOTE_WIDTH = 20;
    const NOTE_HEIGHT = 30;
    const PADDING = 10;
    const Y_START = 220;

    const line_stack = [0, 0, 0];

    let stave_x = PADDING;
    let stave_y = Y_START;
    let instrument_x = 0;
    let instrument_y = 0;
    let max_instrument_width = 0;
    let max_stave_height = 0;
    for (let i = 0; i < this.score.staves.length; i++) {
      let stave = this.score.staves[i];

      let max_measure_width = 0;
      for (let j = i; j < Math.min(i + this.score.num_instruments, this.score.staves.length); j++) {
        let prevision_stave = this.score.staves[j];
        for (let voice of prevision_stave.voices) {
          let voice_width = voice.groups.length * (NOTE_WIDTH + PADDING);
          if (voice_width > max_measure_width) {
            max_measure_width = voice_width;
          }
        }
      }
      if (stave_x + max_measure_width > canvas.width) {
        stave_x = PADDING;
        stave_y += max_stave_height;
        max_stave_height = 0;
      }

      let voice_x = 0;
      let voice_y = 0;
      for (let voice of stave.voices) {
        let group_x = PADDING;
        let group_y = 0;
        let max_group_height = 0;
        for (let group of voice.groups) {
          let group_height = (NOTE_HEIGHT + PADDING) * group.notes.length;
          if (group_height > max_group_height) {
            max_group_height = group_height;
          }
        }
        for (let group of voice.groups) {
          // underlines for duration
          if (group.duration < 1) {
            let notes_until_next_quarter = voice.notes_until_next_quarter(group);
            let notes_in_run = voice.notes_in_same_duration_run(group);
            if (group.duration === 0.125) {
              line_stack[2] = Math.min(notes_in_run, notes_until_next_quarter);
              line_stack[1] = Math.max(line_stack[1], line_stack[2]);
              line_stack[0] = Math.max(line_stack[0], line_stack[2]);
            } else if (group.duration === 0.25) {
              line_stack[2] = 0;
              line_stack[1] = Math.min(notes_in_run, notes_until_next_quarter);
              line_stack[0] = Math.max(line_stack[0], line_stack[1]);
            } else if (group.duration === 0.5) {
              line_stack[2] = 0;
              line_stack[1] = 0;
              line_stack[0] = Math.min(notes_in_run, notes_until_next_quarter);
            }
          } else {
            line_stack[0] = 0;
            line_stack[1] = 0;
            line_stack[2] = 0;
          }

          let note_x = 0;
          let note_y = max_group_height;
          for (let note of group.notes) {
            if (note === this.cursor && !is_print) {
              ctx.fillStyle = "pink";
              ctx.fillRect(
                stave_x + instrument_x + voice_x + group_x + note_x - PADDING / 2,
                stave_y + instrument_y + voice_y + group_y + note_y,
                NOTE_WIDTH,
                NOTE_HEIGHT,
              );
            }

            ctx.font = NOTE_HEIGHT.toString() + "px serif";
            ctx.textAlign = "left";
            ctx.fillStyle = "black";
            ctx.fillText(
              note.number.toString(),
              stave_x + instrument_x + voice_x + group_x + note_x - PADDING / 2,
              stave_y + instrument_y + voice_y + group_y + note_y + NOTE_HEIGHT,
            );

            let dot_x = NOTE_WIDTH / 2;
            let direction = Math.sign(note.dot_level);
            ctx.fillStyle = "black";
            if (direction > 0) {
              let dot_y = note_y - NOTE_HEIGHT - PADDING;
              for (let k = 0; k < Math.abs(note.dot_level); k++) {
                ctx.beginPath();
                ctx.arc(
                  stave_x + instrument_x + voice_x + group_x + note_x - PADDING / 2 + dot_x - 3,
                  stave_y + instrument_y + voice_y + group_y + note_y + dot_y + 2,
                  PADDING / 6,
                  0,
                  2 * Math.PI,
                );
                ctx.fill();
                dot_y -= PADDING / 2;
              }
            } else if (direction < 0) {
              let dot_y = note_y;
              for (let k = 0; k < Math.abs(note.dot_level); k++) {
                ctx.beginPath();
                ctx.arc(
                  stave_x + instrument_x + voice_x + group_x + note_x - PADDING / 2 + dot_x - 3,
                  stave_y + instrument_y + voice_y + group_y + note_y + dot_y - 2,
                  PADDING / 6,
                  0,
                  2 * Math.PI,
                );
                ctx.fill();
                dot_y += PADDING / 2;
              }
            }

            note_y -= NOTE_HEIGHT + PADDING;
          }

          if (line_stack[0] > 0 || line_stack[1] > 0 || line_stack[2] > 0) {
            ctx.fillStyle = "black";
            ctx.lineWidth = 2;

            if (line_stack[2] > 0) {
              let end_padding = line_stack[2] === 1 ? PADDING * 2 : 0;
              ctx.beginPath();
              ctx.moveTo(
                stave_x + instrument_x + voice_x + group_x + note_x - PADDING,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING,
              );
              ctx.lineTo(
                stave_x + instrument_x + voice_x + group_x + note_x + NOTE_WIDTH + PADDING - end_padding,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING,
              );
              ctx.stroke();
            }
            if (line_stack[1] > 0) {
              let end_padding = line_stack[1] === 1 ? PADDING * 2 : 0;
              ctx.beginPath();
              ctx.moveTo(
                stave_x + instrument_x + voice_x + group_x + note_x - PADDING,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING - 3,
              );
              ctx.lineTo(
                stave_x + instrument_x + voice_x + group_x + note_x + NOTE_WIDTH + PADDING - end_padding,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING - 3,
              );
              ctx.stroke();
            }
            if (line_stack[0] > 0) {
              let end_padding = line_stack[0] === 1 ? PADDING * 2 : 0;
              ctx.beginPath();
              ctx.moveTo(
                stave_x + instrument_x + voice_x + group_x + note_x - PADDING,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING - 6,
              );
              ctx.lineTo(
                stave_x + instrument_x + voice_x + group_x + note_x + NOTE_WIDTH + PADDING - end_padding,
                stave_y + instrument_y + voice_y + group_y + max_group_height + NOTE_HEIGHT + PADDING - 6,
              );
              ctx.stroke();
            }
          }

          group_x += NOTE_WIDTH + PADDING;
        }
        voice_y += max_group_height + PADDING;
      }
      max_stave_height += voice_y;

      if (i % this.score.num_instruments === 0 && i > 0) {
        stave_x += max_instrument_width;
        instrument_y = 0;
      } else {
        instrument_y += voice_y;
      }
    }

    this.dot_display();
    this.note_display();
  }
}
Editor.duration_map = [0.125, 0.25, 0.5, 0.75, 1, 2, 3, 4];
Editor.mode_map = ["insert", "after", "overwrite", "read"];

const editor = new Editor();
