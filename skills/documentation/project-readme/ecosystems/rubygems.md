# RubyGems

Use for repositories with `*.gemspec` or `Gemfile`.

## Source files

- `*.gemspec`: name, version, summary, executable, dependencies.
- `Gemfile` and `Gemfile.lock`: dependency workflow.
- `lib/`, `exe/`, `bin/`, `spec/`, `test/`.

## Commands

- Use `bundle install` when a Gemfile exists.
- Use `bundle exec rake`, `bundle exec rspec`, or gemspec executables only when present.
- For gems, show `gem install` only when registry publication is intended.

## Do not invent

- RubyGems badges for non-gem projects.
- Executable names not present in gemspec, `exe/`, or `bin/`.
- Rails-specific setup unless the repo proves it is a Rails app.
