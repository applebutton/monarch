require File.expand_path("#{File.dirname(__FILE__)}/../../monarch_spec_helper")

module Xmpp
  describe Dispatcher do
    attr_reader :dispatcher
    before do
      @dispatcher = Xmpp::Dispatcher.new
    end
    
    describe "#handle_presence" do
      before do
        publicize dispatcher, :handle_presence
      end

      it "creates a Client object with the jid and session_id attributes from the stanza and adds it to the persistent identity map" do
        stanza = Jabber::Presence.new
        stanza.from = "12345@hyperarchy.org/r12345"
        stanza.to = "app.hyperarchy.org"
        stanza.add_attribute("session_id", "fake-session-id")

        dispatcher.handle_presence(stanza)

        client = Client.find(Client[:session_id].eq("fake-session-id").and(Client[:jid].eq("12345@hyperarchy.org/r12345")))
        client.should_not be_nil

        Model::Repository.clear_identity_maps
        Client.find(client.id).should == client
      end
    end
  end
end