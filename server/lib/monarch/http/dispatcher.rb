module Http
  class Dispatcher
    attr_reader :resource_locator
    def initialize(resource_locator)
      @resource_locator = resource_locator
    end

    def call(env)
#      Model::Repository.initialize_local_identity_map

      Model::Repository.with_local_identity_map do
        request = Request.new(env)
        resource_locator.locate(request.path_info, :session_id => request.session_id).send(request.method, request.params)
      end
#      Model::Repository.clear_local_identity_map
#      result
    end
  end
end
