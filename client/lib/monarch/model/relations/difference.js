(function(Monarch) {

Monarch.constructor("Monarch.Model.Relations.Difference", Monarch.Model.Relations.Relation, {
  initialize: function(left_operand, right_operand) {
    this.left_operand = left_operand;
    this.right_operand = right_operand;
    this.initialize_events_system();
  },

  contains: function(record) {
    return record.id() in this.tuples_by_id;
  },

  tuples: function() {
    if (this.tuples_by_id) return Monarch.Util.values(this.tuples_by_id);
    var tuples = [];

    var left_tuples = this.left_operand.tuples().sort(function(a, b) {
      if (a.id() < b.id()) return -1;
      if (a.id() > b.id()) return 1;
      return 0;
    });

    var right_tuples = this.right_operand.tuples().sort(function(a, b) {
      if (a.id() < b.id()) return -1;
      if (a.id() > b.id()) return 1;
      return 0;
    });

    var right_index = 0;

    Monarch.Util.each(left_tuples, function(left_record, index) {
      if (right_tuples[right_index] && left_record.id() === right_tuples[right_index].id()) {
        right_index++;
      } else {
        tuples.push(left_record);
      }
    });

    return tuples;
  },

  // private

  subscribe_to_operands: function() {
    var self = this;
    this.operands_subscription_bundle.add(this.left_operand.on_insert(function(record) {
      if (!self.right_operand.find(record.id())) self.record_inserted(record);
    }));

    this.operands_subscription_bundle.add(this.left_operand.on_update(function(record, changes) {
      if (self.contains(record)) self.record_updated(record, changes);
    }));

    this.operands_subscription_bundle.add(this.left_operand.on_remove(function(record) {
      if (self.contains(record)) self.record_removed(record);
    }));

    this.operands_subscription_bundle.add(this.right_operand.on_insert(function(record) {
      if (self.contains(record)) self.record_removed(record);
    }));

    this.operands_subscription_bundle.add(this.right_operand.on_remove(function(record) {
      if (self.left_operand.find(record.id())) self.record_inserted(record);
    }));
  },

  memoize_tuples: function() {
    var tuples_by_id = {};
    this.each(function(record) {
      tuples_by_id[record.id()] = record;
    }.bind(this));
    this.tuples_by_id = tuples_by_id;
  },

  record_inserted: function(record, options) {
    this.tuples_by_id[record.id()] = record;
    this.on_insert_node.publish(record);
  },

  record_updated: function(record, update_data) {
    this.on_update_node.publish(record, update_data);
  },

  record_removed: function(record) {
    delete this.tuples_by_id[record.id()];
    this.on_remove_node.publish(record);
  }
});

})(Monarch);
