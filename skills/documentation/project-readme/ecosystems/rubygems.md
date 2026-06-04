# RubyGems

Use for repositories with `*.gemspec` or `Gemfile`.

## Source files

- `*.gemspec`: name, version, summary, executable, dependencies.
- `Gemfile` and `Gemfile.lock`: dependency workflow.
- `lib/`, `exe/`, `bin/`, `spec/`, `test/`.

## Commands

- Use `bundle install` and `bundle exec` commands for repository development setup when a Gemfile exists.
- Use `bundle exec rake`, `bundle exec rspec`, or gemspec executables only when present.
- For public or publishable gems, default to compact consumer install alternatives such as `gem install` and `bundle add`.

## Do not invent

- RubyGems badges for non-gem projects.
- Public RubyGems install alternatives for private gems or unpublished source-only apps.
- Executable names not present in gemspec, `exe/`, or `bin/`.
- Rails-specific setup unless the repo proves it is a Rails app.
