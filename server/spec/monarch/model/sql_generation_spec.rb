require File.expand_path("#{File.dirname(__FILE__)}/../../monarch_spec_helper")

module Model
  describe "SQL generation" do
    specify "tables" do
      User.table.to_sql.should be_like(%{
        select users.* from users
      })

      User.table.to_update_sql(:full_name => "John Travolta", :age => 47).should be_like(%{
        update users set age = 47, full_name = "John Travolta"
      })
    end

    specify "combined selections and projections" do
      User.where(:full_name => "Amory Lovins", :age => 40).to_sql.should be_like(%{
        select users.* from users where users.age = 40 and users.full_name = "Amory Lovins"
      })
      User.where(:age => nil).to_sql.should be_like(%{
        select users.* from users where users.age is null
      })
      User.where(User[:age].neq(nil)).to_sql.should be_like(%{
        select users.* from users where users.age is not null
      })
      User.where(:age => 40).project(:id, :full_name).to_sql.should be_like(%{
        select users.id, users.full_name from users where users.age = 40
      })
      User.project(:id, :full_name).where(:full_name => "Nathan Sobo").to_sql.should be_like(%{
        select users.id, users.full_name from users where users.full_name = "Nathan Sobo"
      })
      User.project(:id, :full_name).where(:full_name => "Nathan Sobo").project(:id).to_sql.should be_like(%{
        select users.id from users where users.full_name = "Nathan Sobo"
      })

      User.where(:full_name => "Amory Lovins", :age => 40).to_update_sql(:full_name => "Amorous Loving", :age => 30).should be_like(%{
        update users set age = 30, full_name = "Amorous Loving" where users.age = 40 and users.full_name = "Amory Lovins"
      })
      User.where(:age => 40).project(:id, :full_name).to_update_sql(:full_name => "Lucile Ball").should be_like(%{
        update users set full_name = "Lucile Ball" where users.age = 40
      })
      User.project(:id, :full_name).where(:full_name => "Nathan Sobo").to_update_sql({:full_name => "Nath Sobo"}).should be_like(%{
        update users set full_name = "Nath Sobo" where users.full_name = "Nathan Sobo"
      })
    end

    specify "combined inner joins, selections, and projections" do
      User.join_to(Blog).to_sql.should be_like(%{
        select
          users.id as users__id,
          users.full_name as users__full_name,
          users.age as users__age,
          users.signed_up_at as users__signed_up_at,
          users.has_hair as users__has_hair,
          blogs.id as blogs__id,
          blogs.title as blogs__title,
          blogs.user_id as blogs__user_id
        from users, blogs
        where users.id = blogs.user_id
      })
      User.join_to(Blog.where(:title => "Fun")).to_sql.should be_like(%{
        select
          users.id as users__id,
          users.full_name as users__full_name,
          users.age as users__age,
          users.signed_up_at as users__signed_up_at,
          users.has_hair as users__has_hair,
          blogs.id as blogs__id,
          blogs.title as blogs__title,
          blogs.user_id as blogs__user_id
        from users, blogs
        where blogs.title = "Fun" and users.id = blogs.user_id
      })
      User.join_through(Blog).to_sql.should be_like(%{
        select blogs.* from users, blogs where users.id = blogs.user_id
      })
      User.where(:age => 21).join_through(Blog.where(:title => "I Can Drink Now")).to_sql.should be_like(%{
        select blogs.*
        from users, blogs
        where blogs.title = "I Can Drink Now" and users.age = 21 and users.id = blogs.user_id
      })
      User.where(:age => 21).
        join_through(Blog.where(:title => "I Can Drink Now")).
        join_through(BlogPost.where(:title => "Day 5: The World Is Spining")).to_sql.should be_like(%{
        select
          blog_posts.*
        from
          users, blogs, blog_posts
        where
          blog_posts.title = "Day 5: The World Is Spining"
          and blogs.id = blog_posts.blog_id
          and blogs.title = "I Can Drink Now"
          and users.age = 21
          and users.id = blogs.user_id
      })

      User.where(:age => 21).join_through(Blog.where(:title => "I Can Drink Now")).to_update_sql(:title => "I Am 21").should be_like(%{
        update blogs
        set title = "I Am 21"
        from users, blogs
        where blogs.title = "I Can Drink Now" and users.age = 21 and users.id = blogs.user_id
      })

      User.where(:age => 21).join_through(Blog).where(:title => "I Can Drink Now").to_update_sql(:title => "I Am 21").should be_like(%{
        update blogs
        set title = "I Am 21"
        from users, blogs
        where blogs.title = "I Can Drink Now" and users.age = 21 and users.id = blogs.user_id
      })
    end

#    specify "unions" do
#      puts union(Blog.where(:title => "Good Times"), Blog.where(:title => "Bad Times")).to_sql
#    end

    specify "projections involving aggregation functions composed on top of other constructs" do
      User.project(User[:id].count).to_sql.should be_like(%{select count(users.id) from users})
      User.where(:age => 34).project(User[:id].count).to_sql.should be_like(%{
        select count(users.id) from users where users.age = 34
      })
      User.where(:id => 1).join_through(Blog).project(Blog[:id].count, :id).to_sql.should be_like(%{
        select count(blogs.id), blogs.id
        from users, blogs 
        where users.id = 1 and users.id = blogs.user_id
      })
    end
  end
end