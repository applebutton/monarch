module Http
  class CometClient
    RECONNECT_INTERVAL = 5
    attr_reader :id, :transport, :hub, :subscriptions

    def initialize(id, hub)
      @id, @hub = id, hub
      @subscriptions = Util::SubscriptionBundle.new
      @queued_messages = []
      start_reconnect_timer
    end

    def transport=(transport)
      @transport = transport
      cancel_reconnect_timer
      flush_queued_messages
      transport.on_close do
        start_reconnect_timer
      end
    end

    def send(message)
      if transport
        transport.write(message.to_json + "\n")
      else
        queued_messages.push(message)
      end
    end

    def flush_queued_messages
      while !queued_messages.empty?
        send(queued_messages.shift)
      end
    end

    def subscribe(relation)
      subscriptions.add(relation.on_insert do |record|
        send(["create", relation.exposed_name.to_s, record.wire_representation])
      end)

      subscriptions.add(relation.on_update do |record, changeset|
        send(["update", relation.exposed_name.to_s, record.id, changeset.wire_representation])
      end)

      subscriptions.add(relation.on_remove do |record|
        send(["destroy", relation.exposed_name.to_s, record.id])
      end)
    end

    private
    attr_reader :reconnect_timer, :queued_messages

    def start_reconnect_timer
      @reconnect_timer = EM::Timer.new(RECONNECT_INTERVAL) do
        went_offline
      end
    end

    def cancel_reconnect_timer
      reconnect_timer.cancel if reconnect_timer
    end

    def went_offline
      hub.remove_client(id)
      subscriptions.destroy_all
    end
  end
end
