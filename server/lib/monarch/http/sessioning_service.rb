module Http
  class SessioningService
    attr_accessor :app

    def initialize(app)
      @app = app
    end

    def call(env)
      request = Request.new(env)
      if request.cookies["_session_id"]
        session_id = Array(request.cookies["_session_id"]).first
        if Session.find(Session[:session_id].eq(session_id))
          request.session_id = session_id
          app.call(request.env)
        else
          call_with_new_session(request)
        end
      else
        call_with_new_session(request)
      end
    end

    def call_with_new_session(request)
      session_id = Session.create!.session_id
      request.session_id = session_id
      response = Response.new(*app.call(request.env))
      response.cookies["_session_id"] = session_id
      response.to_a
    end
  end
end
