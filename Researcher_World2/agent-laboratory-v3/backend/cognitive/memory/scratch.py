"""
Scratch (Short-term / Working Memory) for generative agents.
Ported from Park et al. (UIST 2023), extended for FL research context.

Holds:
  - Agent identity (name, traits, role)
  - Current action state (address, description, duration)
  - Daily schedule and planning
  - Reflection parameters
  - Chat state
  - FL-specific fields (lab_id, fl_role, cognitive_step_interval)
"""
import datetime
import json

from cognitive import check_if_file_exists


class Scratch:
    def __init__(self, f_saved=None):
        # PERSONA HYPERPARAMETERS
        self.vision_r = 4
        self.att_bandwidth = 3
        self.retention = 5

        # WORLD INFORMATION
        self.curr_time = None
        self.curr_tile = None
        self.daily_plan_req = None

        # CORE IDENTITY
        self.name = None
        self.first_name = None
        self.last_name = None
        self.age = None
        self.innate = None       # L0 permanent core traits
        self.learned = None      # L1 stable traits
        self.currently = None    # L2 current role/activity
        self.lifestyle = None
        self.living_area = None

        # REFLECTION VARIABLES
        self.concept_forget = 100
        self.daily_reflection_time = 60 * 3
        self.daily_reflection_size = 5
        self.overlap_reflect_th = 2
        self.kw_strg_event_reflect_th = 4
        self.kw_strg_thought_reflect_th = 4

        self.recency_w = 1
        self.relevance_w = 1
        self.importance_w = 1
        self.recency_decay = 0.99
        self.importance_trigger_max = 150
        self.importance_trigger_curr = self.importance_trigger_max
        self.importance_ele_n = 0
        self.thought_count = 5

        # PLANNING
        self.daily_req = []
        self.f_daily_schedule = []
        self.f_daily_schedule_hourly_org = []

        # CURRENT ACTION
        self.act_address = None
        self.act_start_time = None
        self.act_duration = None
        self.act_description = None
        self.act_pronunciatio = None
        self.act_event = (self.name, None, None)

        self.act_obj_description = None
        self.act_obj_pronunciatio = None
        self.act_obj_event = (self.name, None, None)

        # CHAT STATE
        self.chatting_with = None
        self.chat = None
        self.chatting_with_buffer = dict()
        self.chatting_end_time = None

        # PATH PLANNING
        self.act_path_set = False
        self.planned_path = []

        # FL-SPECIFIC FIELDS (extension for federated learning context)
        self.lab_id = None
        self.fl_role = None
        self.fl_specialization = None
        self.cognitive_step_interval = 5  # Mesa steps between cognitive cycles

        # Load from file if provided
        if f_saved and check_if_file_exists(f_saved):
            with open(f_saved) as f:
                scratch_load = json.load(f)
            self._load_from_dict(scratch_load)

    def _load_from_dict(self, d):
        """Load scratch state from a dictionary."""
        self.vision_r = d.get("vision_r", self.vision_r)
        self.att_bandwidth = d.get("att_bandwidth", self.att_bandwidth)
        self.retention = d.get("retention", self.retention)

        if d.get("curr_time"):
            self.curr_time = datetime.datetime.strptime(
                d["curr_time"], "%B %d, %Y, %H:%M:%S")
        self.curr_tile = d.get("curr_tile", self.curr_tile)
        self.daily_plan_req = d.get("daily_plan_req", self.daily_plan_req)

        self.name = d.get("name", self.name)
        self.first_name = d.get("first_name", self.first_name)
        self.last_name = d.get("last_name", self.last_name)
        self.age = d.get("age", self.age)
        self.innate = d.get("innate", self.innate)
        self.learned = d.get("learned", self.learned)
        self.currently = d.get("currently", self.currently)
        self.lifestyle = d.get("lifestyle", self.lifestyle)
        self.living_area = d.get("living_area", self.living_area)

        self.concept_forget = d.get("concept_forget", self.concept_forget)
        self.daily_reflection_time = d.get("daily_reflection_time", self.daily_reflection_time)
        self.daily_reflection_size = d.get("daily_reflection_size", self.daily_reflection_size)
        self.overlap_reflect_th = d.get("overlap_reflect_th", self.overlap_reflect_th)
        self.kw_strg_event_reflect_th = d.get("kw_strg_event_reflect_th", self.kw_strg_event_reflect_th)
        self.kw_strg_thought_reflect_th = d.get("kw_strg_thought_reflect_th", self.kw_strg_thought_reflect_th)

        self.recency_w = d.get("recency_w", self.recency_w)
        self.relevance_w = d.get("relevance_w", self.relevance_w)
        self.importance_w = d.get("importance_w", self.importance_w)
        self.recency_decay = d.get("recency_decay", self.recency_decay)
        self.importance_trigger_max = d.get("importance_trigger_max", self.importance_trigger_max)
        self.importance_trigger_curr = d.get("importance_trigger_curr", self.importance_trigger_curr)
        self.importance_ele_n = d.get("importance_ele_n", self.importance_ele_n)
        self.thought_count = d.get("thought_count", self.thought_count)

        self.daily_req = d.get("daily_req", self.daily_req)
        self.f_daily_schedule = d.get("f_daily_schedule", self.f_daily_schedule)
        self.f_daily_schedule_hourly_org = d.get("f_daily_schedule_hourly_org", self.f_daily_schedule_hourly_org)

        self.act_address = d.get("act_address", self.act_address)
        if d.get("act_start_time"):
            self.act_start_time = datetime.datetime.strptime(
                d["act_start_time"], "%B %d, %Y, %H:%M:%S")
        self.act_duration = d.get("act_duration", self.act_duration)
        self.act_description = d.get("act_description", self.act_description)
        self.act_pronunciatio = d.get("act_pronunciatio", self.act_pronunciatio)
        if d.get("act_event"):
            self.act_event = tuple(d["act_event"])

        self.act_obj_description = d.get("act_obj_description", self.act_obj_description)
        self.act_obj_pronunciatio = d.get("act_obj_pronunciatio", self.act_obj_pronunciatio)
        if d.get("act_obj_event"):
            self.act_obj_event = tuple(d["act_obj_event"])

        self.chatting_with = d.get("chatting_with", self.chatting_with)
        self.chat = d.get("chat", self.chat)
        self.chatting_with_buffer = d.get("chatting_with_buffer", self.chatting_with_buffer)
        if d.get("chatting_end_time"):
            self.chatting_end_time = datetime.datetime.strptime(
                d["chatting_end_time"], "%B %d, %Y, %H:%M:%S")

        self.act_path_set = d.get("act_path_set", self.act_path_set)
        self.planned_path = d.get("planned_path", self.planned_path)

        # FL-specific
        self.lab_id = d.get("lab_id", self.lab_id)
        self.fl_role = d.get("fl_role", self.fl_role)
        self.fl_specialization = d.get("fl_specialization", self.fl_specialization)
        self.cognitive_step_interval = d.get("cognitive_step_interval", self.cognitive_step_interval)

    def save(self, out_json):
        """Save scratch state to JSON file."""
        scratch = dict()
        scratch["vision_r"] = self.vision_r
        scratch["att_bandwidth"] = self.att_bandwidth
        scratch["retention"] = self.retention

        scratch["curr_time"] = (self.curr_time.strftime("%B %d, %Y, %H:%M:%S")
                                if self.curr_time else None)
        scratch["curr_tile"] = self.curr_tile
        scratch["daily_plan_req"] = self.daily_plan_req

        scratch["name"] = self.name
        scratch["first_name"] = self.first_name
        scratch["last_name"] = self.last_name
        scratch["age"] = self.age
        scratch["innate"] = self.innate
        scratch["learned"] = self.learned
        scratch["currently"] = self.currently
        scratch["lifestyle"] = self.lifestyle
        scratch["living_area"] = self.living_area

        scratch["concept_forget"] = self.concept_forget
        scratch["daily_reflection_time"] = self.daily_reflection_time
        scratch["daily_reflection_size"] = self.daily_reflection_size
        scratch["overlap_reflect_th"] = self.overlap_reflect_th
        scratch["kw_strg_event_reflect_th"] = self.kw_strg_event_reflect_th
        scratch["kw_strg_thought_reflect_th"] = self.kw_strg_thought_reflect_th

        scratch["recency_w"] = self.recency_w
        scratch["relevance_w"] = self.relevance_w
        scratch["importance_w"] = self.importance_w
        scratch["recency_decay"] = self.recency_decay
        scratch["importance_trigger_max"] = self.importance_trigger_max
        scratch["importance_trigger_curr"] = self.importance_trigger_curr
        scratch["importance_ele_n"] = self.importance_ele_n
        scratch["thought_count"] = self.thought_count

        scratch["daily_req"] = self.daily_req
        scratch["f_daily_schedule"] = self.f_daily_schedule
        scratch["f_daily_schedule_hourly_org"] = self.f_daily_schedule_hourly_org

        scratch["act_address"] = self.act_address
        scratch["act_start_time"] = (self.act_start_time.strftime("%B %d, %Y, %H:%M:%S")
                                     if self.act_start_time else None)
        scratch["act_duration"] = self.act_duration
        scratch["act_description"] = self.act_description
        scratch["act_pronunciatio"] = self.act_pronunciatio
        scratch["act_event"] = list(self.act_event) if self.act_event else None

        scratch["act_obj_description"] = self.act_obj_description
        scratch["act_obj_pronunciatio"] = self.act_obj_pronunciatio
        scratch["act_obj_event"] = list(self.act_obj_event) if self.act_obj_event else None

        scratch["chatting_with"] = self.chatting_with
        scratch["chat"] = self.chat
        scratch["chatting_with_buffer"] = self.chatting_with_buffer
        scratch["chatting_end_time"] = (self.chatting_end_time.strftime("%B %d, %Y, %H:%M:%S")
                                        if self.chatting_end_time else None)

        scratch["act_path_set"] = self.act_path_set
        scratch["planned_path"] = self.planned_path

        # FL-specific
        scratch["lab_id"] = self.lab_id
        scratch["fl_role"] = self.fl_role
        scratch["fl_specialization"] = self.fl_specialization
        scratch["cognitive_step_interval"] = self.cognitive_step_interval

        with open(out_json, "w") as outfile:
            json.dump(scratch, outfile, indent=2)

    # === Getter methods (used by prompt templates) ===

    def get_f_daily_schedule_index(self, advance=0):
        """Get current index into f_daily_schedule based on curr_time."""
        if not self.curr_time:
            return 0
        today_min_elapsed = self.curr_time.hour * 60 + self.curr_time.minute + advance
        curr_index = 0
        elapsed = 0
        for task, duration in self.f_daily_schedule:
            elapsed += duration
            if elapsed > today_min_elapsed:
                return curr_index
            curr_index += 1
        return curr_index

    def get_f_daily_schedule_hourly_org_index(self, advance=0):
        """Get current index into f_daily_schedule_hourly_org based on curr_time."""
        if not self.curr_time:
            return 0
        today_min_elapsed = self.curr_time.hour * 60 + self.curr_time.minute + advance
        curr_index = 0
        elapsed = 0
        for task, duration in self.f_daily_schedule_hourly_org:
            elapsed += duration
            if elapsed > today_min_elapsed:
                return curr_index
            curr_index += 1
        return curr_index

    def get_str_iss(self):
        """Identity Stable Set - core persona summary for prompts."""
        commonset = ""
        commonset += f"Name: {self.name}\n"
        commonset += f"Age: {self.age}\n"
        commonset += f"Innate traits: {self.innate}\n"
        commonset += f"Learned traits: {self.learned}\n"
        commonset += f"Currently: {self.currently}\n"
        commonset += f"Lifestyle: {self.lifestyle}\n"
        commonset += f"Daily plan requirement: {self.daily_plan_req}\n"
        if self.curr_time:
            commonset += f"Current Date: {self.curr_time.strftime('%A %B %d')}\n"
        return commonset

    def get_str_name(self):
        return self.name

    def get_str_firstname(self):
        return self.first_name

    def get_str_lastname(self):
        return self.last_name

    def get_str_age(self):
        return str(self.age)

    def get_str_innate(self):
        return self.innate

    def get_str_learned(self):
        return self.learned

    def get_str_currently(self):
        return self.currently

    def get_str_lifestyle(self):
        return self.lifestyle

    def get_str_daily_plan_req(self):
        return self.daily_plan_req

    def get_str_curr_date_str(self):
        if self.curr_time:
            return self.curr_time.strftime("%A %B %d")
        return ""

    def get_curr_event(self):
        if not self.act_address:
            return (self.name, None, None)
        return self.act_event

    def get_curr_event_and_desc(self):
        if not self.act_address:
            return (self.name, None, None, None)
        return (self.act_event[0],
                self.act_event[1],
                self.act_event[2],
                self.act_description)

    def get_curr_obj_event_and_desc(self):
        if not self.act_address:
            return ("", None, None, None)
        return (self.act_address,
                self.act_obj_event[1],
                self.act_obj_event[2],
                self.act_obj_description)

    def add_new_action(self,
                       action_address,
                       action_duration,
                       action_description,
                       action_pronunciatio,
                       action_event,
                       chatting_with,
                       chat,
                       chatting_with_buffer,
                       chatting_end_time,
                       act_obj_description,
                       act_obj_pronunciatio,
                       act_obj_event,
                       act_start_time=None):
        self.act_address = action_address
        self.act_duration = action_duration
        self.act_description = action_description
        self.act_pronunciatio = action_pronunciatio
        self.act_event = action_event

        self.chatting_with = chatting_with
        self.chat = chat
        if chatting_with_buffer:
            self.chatting_with_buffer.update(chatting_with_buffer)
        self.chatting_end_time = chatting_end_time

        self.act_obj_description = act_obj_description
        self.act_obj_pronunciatio = act_obj_pronunciatio
        self.act_obj_event = act_obj_event

        self.act_start_time = self.curr_time
        self.act_path_set = False

    def act_time_str(self):
        if self.act_start_time:
            return self.act_start_time.strftime("%H:%M %p")
        return ""

    def act_check_finished(self):
        """Check if current action has finished based on time."""
        if not self.act_address:
            return True

        if self.chatting_with:
            end_time = self.chatting_end_time
        else:
            x = self.act_start_time
            if x and x.second != 0:
                x = x.replace(second=0)
                x = x + datetime.timedelta(minutes=1)
            end_time = (x + datetime.timedelta(minutes=self.act_duration)) if x else None

        if end_time and self.curr_time:
            if end_time.strftime("%H:%M:%S") == self.curr_time.strftime("%H:%M:%S"):
                return True
        return False

    def act_summarize(self):
        return {
            "persona": self.name,
            "address": self.act_address,
            "start_datetime": self.act_start_time,
            "duration": self.act_duration,
            "description": self.act_description,
            "pronunciatio": self.act_pronunciatio
        }

    def act_summary_str(self):
        if not self.act_start_time:
            return ""
        start_datetime_str = self.act_start_time.strftime("%A %B %d -- %H:%M %p")
        ret = f"[{start_datetime_str}]\n"
        ret += f"Activity: {self.name} is {self.act_description}\n"
        ret += f"Address: {self.act_address}\n"
        ret += f"Duration in minutes (e.g., x min): {self.act_duration} min\n"
        return ret

    def get_str_daily_schedule_summary(self):
        ret = ""
        curr_min_sum = 0
        for row in self.f_daily_schedule:
            curr_min_sum += row[1]
            hour = int(curr_min_sum / 60)
            minute = curr_min_sum % 60
            ret += f"{hour:02}:{minute:02} || {row[0]}\n"
        return ret

    def get_str_daily_schedule_hourly_org_summary(self):
        ret = ""
        curr_min_sum = 0
        for row in self.f_daily_schedule_hourly_org:
            curr_min_sum += row[1]
            hour = int(curr_min_sum / 60)
            minute = curr_min_sum % 60
            ret += f"{hour:02}:{minute:02} || {row[0]}\n"
        return ret
